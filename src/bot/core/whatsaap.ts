import NodeCache from "@cacheable/node-cache";
import makeWASocket, {
    CacheStore,
    fetchLatestBaileysVersion,
    GroupMetadata,
    makeCacheableSignalKeyStore,
    proto,
    useMultiFileAuthState,
    WASocket,
} from "baileys";
import P from "pino";
import path from "path";
import fs from "fs";
import didYouMean from "didyoumean";

import logger from "../../shared/lib/logger";
import { ClientEvent, PayloadMessage } from "../type/client";
import { RequestLimiter } from "./request-limiter";
import { CommandManager } from "./command-manager";
import { MessageClient } from "./message-client";
import { ContactManager } from "./contact-manager";
import { SessionManager } from "./session-manager";

/**
 * Kelas utama yang mengelola koneksi, sesi, dan modul-modul inti dari bot WhatsApp.
 * Bertindak sebagai pusat koordinator untuk semua manajer lainnya.
 */
export class WhatsappClient {
    // Manajer untuk setiap fungsionalitas inti
    public readonly commandManager: CommandManager;
    public readonly sessionManager: SessionManager;
    public readonly requestLimiter: RequestLimiter;
    public readonly messageClient: MessageClient;
    public readonly contactManager: ContactManager;

    // Utilitas dan state
    public readonly logger = logger;
    public readonly groupCache = new NodeCache<GroupMetadata>();
    public startTime: number = 0;

    private session: WASocket | null = null;
    private readonly msgRetryCounterCache = new NodeCache();
    private readonly authFolderPath = path.resolve(process.cwd(), '.wa-auth');

    constructor() {
        // Inisialisasi semua manajer
        this.commandManager = new CommandManager(this);
        this.sessionManager = new SessionManager(this);
        this.contactManager = new ContactManager(this);
        this.messageClient = new MessageClient();
        this.requestLimiter = new RequestLimiter();
    }

    // =================================================================================
    // Siklus Hidup (Lifecycle)
    // =================================================================================

    /**
     * Membuat dan menginisialisasi sesi baru dengan WhatsApp.
     */
    public async createSession(): Promise<void> {
        this.startTime = Date.now();
        const { state, saveCreds } = await useMultiFileAuthState(this.authFolderPath);
        const { version, isLatest } = await fetchLatestBaileysVersion();
        this.logger.info(`Using Baileys version: ${version.join('.')}, isLatest: ${isLatest}`);

        this.session = makeWASocket({
            version,
            logger: P({ level: "silent" }),
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys),
            },
            msgRetryCounterCache: this.msgRetryCounterCache as CacheStore,
            generateHighQualityLinkPreview: true,
            cachedGroupMetadata: async (jid) => this.groupCache.get(jid),
        });

        await this._initializeModules();

        this.session.ev.on('creds.update', saveCreds);
    }

    /**
     * Menghancurkan sesi aktif dan membersihkan file autentikasi jika diminta.
     */
    public async destroySession(deleteAuthFolder = false): Promise<void> {
        try {
            await this.session?.logout();
            if (deleteAuthFolder && fs.existsSync(this.authFolderPath)) {
                await fs.promises.rm(this.authFolderPath, { recursive: true, force: true });
                this.logger.info("Authentication folder deleted.");
            }
        } catch (error) {
            this.logger.error("Error during session destruction:", error);
        } finally {
            this.session = null;
        }
    }
    
    // =================================================================================
    // Getters dan Utilitas
    // =================================================================================

    public getSession(): WASocket | null {
        if (!this.session) this.logger.warn("Attempted to get a non-existent session.");
        return this.session;
    }

    public getPrefix(): string {
        return process.env.PREFIX || '!';
    }

    public getInfoClient() {
        const user = this.session?.user;
        if (!user) {
            this.logger.warn("Session or user info is not available.");
            return null;
        }
        return {
            name: user.name || "Unknown",
            phone: user.id.split(":")[0] || "Unknown",
            lid: user.lid?.split(":")[0] || "Unknown",
        };
    }
    
    /**
     * Mengirim balasan default jika command tidak ditemukan, dengan saran jika memungkinkan.
     */
    public async defaultMessageReply(message: proto.IWebMessageInfo, payload: PayloadMessage): Promise<void> {
        
        const remoteJid = message.key?.remoteJid;
        if (!remoteJid || !payload.originalText) return;
        
        const commandName = payload.text.split(' ')[0].replace(this.getPrefix(), '');
        const allCommandNames = this.commandManager.getAllCommands().map(cmd => cmd.name);
        
        // Jangan kirim balasan jika command sebenarnya ada tapi mungkin gagal di middleware
        if (allCommandNames.includes(commandName)) return;
        
        const suggestion = didYouMean(commandName, allCommandNames) as string | false;
        let replyText = `Perintah tidak ditemukan. Gunakan *${this.getPrefix()}help* untuk melihat daftar perintah.`;

        if (suggestion) {
            replyText = `Mungkin yang Anda maksud adalah: *${this.getPrefix()}${suggestion}*`;
        }

        await this.messageClient.sendMessage(remoteJid, { text: replyText });
    }

    // =================================================================================
    // Metode Privat (Helpers)
    // =================================================================================

    /**
     * Menginisialisasi semua modul dan memuat event listeners.
     */
    private async _initializeModules(): Promise<void> {
    
        if(this.session){
            this.messageClient.initialize(this);
        }

        await this.commandManager.initialize();
        await this.contactManager.initialize();

        const eventPath = path.resolve(__dirname, '..', 'event');
        const loadedEvents = await this._loadModulesFromDirectory<ClientEvent>(eventPath);

        for (const event of loadedEvents) {
            this.session?.ev.on(event.event, (arg: any) => event.listener(arg, this));
        }
        this.logger.info(`Total ${loadedEvents.length} events initialized.`);
    }

    /**
     * Utilitas generik untuk memuat semua modul dari sebuah direktori.
     */
    private async _loadModulesFromDirectory<T>(dirPath: string): Promise<T[]> {
        const loadedModules: T[] = [];
        if (!fs.existsSync(dirPath)) return loadedModules;

        const files = fs.readdirSync(dirPath).filter(file => file.endsWith('.js') || file.endsWith('.ts'));

        for (const file of files) {
            try {
                const modulePath = path.join(dirPath, file);
                const module = await import(modulePath);
                const content: T = module.default || module;
                if (content) {
                    loadedModules.push(content);
                }
            } catch (error) {
                this.logger.error(`Failed to load module from ${file}:`, error);
            }
        }
        return loadedModules;
    }
}