import { BaileysEventMap, proto, WAMessage } from "baileys";
import path from "path";
import fs from "fs";
import { Client, ClientMiddlewareType, CommandType, PayloadMessage, SessionUserType } from "../type/client";
import { extractCommandFromPrefix, extractContactId, extractLid, extractMessageFromGroupMessage, middlewareApplier } from "../lib/util";
import logger from "../../shared/lib/logger";
import { limiterMiddleware } from "../middleware/request-limiter";
import { MessageClient } from "./message-client";

/**
 * Mengelola semua command (perintah) yang tersedia untuk bot,
 * termasuk memuat, mengambil, dan mengeksekusi perintah berdasarkan pesan masuk.
 */
export class CommandManager {
    private commands: Map<string, CommandType> = new Map();
    private client: Client;
    private middlewares: { command: string[], middleware: ClientMiddlewareType }[] = [{ command: ["*"], middleware: limiterMiddleware }];

    constructor(client: Client) {
        this.client = client;
    }

    // =================================================================================
    // Manajemen Command
    // =================================================================================

    /**
     * Mendaftarkan sebuah command baru ke dalam manager.
     * @param command Objek command yang akan ditambahkan.
     */
    public addCommand(command: CommandType): void {
        this.commands.set(command.name.toLowerCase(), command);
    }

    /**
     * Mengambil sebuah command berdasarkan namanya.
     * @param name Nama command.
     * @returns Objek command jika ditemukan, jika tidak maka undefined.
     */
    public getCommand(name: string): CommandType | undefined {
        return this.commands.get(name.toLowerCase());
    }

    /**
     * Mengambil semua command yang terdaftar.
     * @returns Array dari semua objek command.
     */
    public getAllCommands(): CommandType[] {
        return Array.from(this.commands.values());
    }

    /**
     * Mengambil total command yang sudah dimasukan
     */
    public getCommandCount(): number {
        return this.commands.size;
    }

    /**
     * Menginisialisasi command manager dengan memuat semua file command dari direktori.
     */
    public async initialize(): Promise<void> {
        await this.loadCommandsFromDirectory();
    }

    /**
     * Memuat semua file command dari direktori '../command'.
     * Metode ini mendukung modul CommonJS (.js) dan ES (.ts).
     */
    private async loadCommandsFromDirectory(): Promise<void> {
        const commandDir = path.resolve(__dirname, '..', 'command');
        if (!fs.existsSync(commandDir)) {
            this.client.logger.warn(`Command directory not found: ${commandDir}`);
            return;
        }

        const commandFiles = fs.readdirSync(commandDir).filter(file => file.endsWith('.js') || file.endsWith('.ts'));

        for (const file of commandFiles) {
            try {
                const filePath = path.join(commandDir, file);
                const module = await import(filePath);
                const command: CommandType = module.default || module;

                if (command && command.name) {
                    this.addCommand(command);
                }
            } catch (error) {
                this.client.logger.error(`Failed to load command from ${file}:`, error);
            }
        }
        this.client.logger.info(`Total ${this.commands.size} commands initialized.`);
    }

    /**
     * Menambahkan middleware ke dalam daftar middleware yang akan diterapkan.
     * @param middleware Middleware yang akan ditambahkan.
     */
    /**
     * Menambahkan middleware ke dalam daftar middleware yang akan diterapkan.
     * @param command Nama command (string), array of command, atau middleware global ('*').
     * @param middleware Middleware yang akan ditambahkan.
     */
    /**
     * Menambahkan satu atau beberapa middleware ke satu atau beberapa command.
     * Contoh penggunaan:
     *   addMiddleware("admin", fn1, fn2)
     *   addMiddleware(["admin", "user"], fn1, fn2)
     *   addMiddleware(fn1, fn2) // global
     * @param command Nama command (string), array of command, atau langsung middleware global.
     * @param middlewares Satu atau lebih middleware function.
     */
    public addMiddleware(
        commandOrMiddleware: string | string[] | ClientMiddlewareType,
        ...middlewares: ClientMiddlewareType[]
    ): void {
        if (typeof commandOrMiddleware === "function") {
            [commandOrMiddleware, ...middlewares].forEach(mw => {
                this.middlewares.push({ command: ["*"], middleware: mw });
            });
        } else {
            if (
                (typeof commandOrMiddleware === "string" && commandOrMiddleware.trim() === "") ||
                (Array.isArray(commandOrMiddleware) && commandOrMiddleware.some(cmd => cmd.trim() === ""))
            ) {
                throw new Error("Invalid command name: empty string is not allowed");
            }
            middlewares.forEach(mw => {
                this.middlewares.push({
                    command: Array.isArray(commandOrMiddleware) ? commandOrMiddleware : [commandOrMiddleware],
                    middleware: mw
                });
            });
        }
    }

    // =================================================================================
    // Pemrosesan Pesan Masuk
    // =================================================================================

    /**
     * Titik masuk utama untuk memproses event 'messages.upsert'.
     * @param data Data event dari Baileys.
     */
    public async processIncomingMessage(data: BaileysEventMap["messages.upsert"]): Promise<void> {
        const message = data.messages[0];

        if (message.key.fromMe || !message.message || !message.key.remoteJid) {
            return;
        }

        const clientInfo = this.client.getInfoClient();
        const text = extractMessageFromGroupMessage(MessageClient.getMessageText(message)).trim();
        const isMentioned = MessageClient.extractMentionedJids(message).some(jid => {
            if (jid.endsWith("@lid")) {
                return extractLid(jid).includes(clientInfo?.lid || "");
            }
            return extractContactId(jid) === clientInfo?.phone;
        })

        const senderJid = message.key.remoteJid.endsWith("@g.us")
            ? message.key.participant || ""
            : message.key.remoteJid;

        if (!senderJid) return;


        const payload: PayloadMessage = {
            from: senderJid,
            groupId: message.key.remoteJid.endsWith("@g.us") ? message.key.remoteJid : undefined,
            originalText: text,
            command: extractCommandFromPrefix(text) || "",
            text: extractCommandFromPrefix(text) ? text.split(" ").slice(1).join(" ") : text,
            timestamp: Date.now(),
            message: MessageClient.normalizeMessage(message),
            isGroup: message.key.remoteJid?.endsWith("@g.us") || false,
            mentionedIds: MessageClient.extractMentionedJids(message),
            isMentioned
        };


        try {
            await middlewareApplier(
                { client: this.client, message, payload },
                this.middlewares,
                () => this.routeMessage(message, payload, senderJid)
            );
        } catch (error) {
            logger.error(`Middleware or command processing failed for ${senderJid}:`, error);
        } finally {
            this.client.requestLimiter.endRequest(senderJid);
        }
    }

    /**
     * Mengarahkan pesan ke handler yang sesuai (user dalam sesi atau user normal).
     * @param message Objek pesan Baileys.
     * @param senderJid JID pengirim.
     */
    private async routeMessage(message: WAMessage, payload: PayloadMessage, senderJid: string): Promise<void> {

        const unwrappedContent = MessageClient.normalizeMessage(message);
        if (!unwrappedContent) return;

        if (!this.shouldProcessMessage(payload)) return;


        const userSession = this.client.sessionManager.getUserSession(senderJid);
        if (userSession) {
            this.handleUserInSession(payload, message, userSession);
        } else {
            this.handleNormalUser(payload, message);
        }
    }

    /**
     * Memproses command dari user yang sedang dalam sesi interaktif.
     */
    private handleUserInSession(payload: PayloadMessage, message: WAMessage, userSession: SessionUserType): void {

        if (this.handleSessionNavigation(payload.command, message, userSession)) {
            return;
        }

        const sessionCommand = userSession.session.commands?.find(c => c.name.toLowerCase() === payload.command.toLowerCase());

        if (sessionCommand) {
            sessionCommand.execute(message, this.client, payload, userSession.data);
        } else {
            const helpText = this.buildHelpMessage(userSession.session, userSession.current.length > 1);
            this.client.messageClient.sendMessage(message.key?.remoteJid!, { text: helpText });
        }
    }

    /**
     * Memproses command dari user normal (tidak dalam sesi).
     */
    private handleNormalUser(payload: PayloadMessage, message: WAMessage): void {
        const command = this.getCommand(payload.command);

        if (command) {
            command.execute(message, this.client, payload);
        } else {
            this.client.defaultMessageReply(message, payload);
        }
    }

    // =================================================================================
    // Fungsi Pembantu (Helpers)
    // =================================================================================

    /**
     * Memeriksa apakah pesan harus diproses, terutama di grup (harus mention bot).
     * @param payload Payload pesan yang sudah dibuat.
     * @returns `true` jika pesan harus diproses.
     */
    private shouldProcessMessage(payload: PayloadMessage): boolean {
        if (!payload.isGroup) return true;

        const clientInfo = this.client.getInfoClient();
        if (!clientInfo) return false;

        return payload.mentionedIds.some(jid => {
            if (jid.endsWith("@lid")) {
                return extractLid(jid).includes(clientInfo.lid || "");
            }
            return extractContactId(jid) === clientInfo.phone;
        });
    }

    /**
     * Mengelola navigasi dalam sesi seperti /exit dan /back.
     * @returns `true` jika command adalah navigasi dan sudah ditangani.
     */
    private handleSessionNavigation(commandName: string, msg: proto.IWebMessageInfo, session: SessionUserType): boolean {
        const lowerCaseCommand = commandName.toLowerCase();

        if (lowerCaseCommand === '/exit') {
            this.client.sessionManager.endSessionForUser(msg);
            this.client.messageClient.sendMessage(msg.key?.remoteJid!, { text: `Sesi *${session.session.name}* telah diakhiri.` });
            return true;
        }

        if (lowerCaseCommand === '/back' && session.current.length > 1) {
            this.client.sessionManager.goBackInSession(msg, 1);

            const current = session.current.slice(0, -1);

            let command = this.client.commandManager.getCommand(current[0]);

            for (let i = 1; i < current.length; i++) {
                if (!command || !command.commands) return false;
                command = command.commands.find(c => c.name === session.current[i]);
            }

            if (!command) return false;
            const helpMessage = this.buildHelpMessage(command, current.length > 1);
            this.client.messageClient?.sendMessage(msg.key?.remoteJid!, { text: helpMessage });
            return true;
        }

        return false;
    }

    /**
     * Membangun teks bantuan/menu berdasarkan command yang tersedia.
     */
    public buildHelpMessage(command: CommandType, isSubSession: boolean): string {
        if (!command.commands || command.commands.length === 0) {
            return "Tidak ada perintah lanjutan yang tersedia. Ketik *`/exit`* untuk keluar.";
        }

        let content = `Silakan pilih salah satu perintah berikut:`;
        command.commands.forEach(cmd => {
            content += `\n- *\`${cmd.name}\`* ${cmd.description || ''}`;
        });

        if (isSubSession) {
            content += "\n- *`/back`* untuk kembali ke menu sebelumnya.";
        }
        content += "\n- *`/exit`* untuk keluar dari sesi.";

        return content;
    }
}