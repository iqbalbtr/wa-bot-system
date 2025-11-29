import {
    AnyMessageContent,
    MiscMessageGenerationOptions,
    proto,
    WASocket,
} from "baileys";
import { WhatsappClient } from "./whatsaap";
import logger from "../../shared/lib/logger";
import fs from "fs";
import mime from "mime-types";

/**
 * Interface untuk pesan yang tertunda (pending) dan akan dikirim
 * setelah koneksi WhatsApp berhasil dibuat.
 */
type PendingMessage = {
    timestamp: number;
    recipientJid: string;
    content: AnyMessageContent;
    options?: MiscMessageGenerationOptions;
};

/**
 * MessageClient bertanggung jawab untuk mengirim pesan WhatsApp.
 * Jika sesi belum aktif, pesan akan ditampung dalam antrian (queue)
 * dan dikirim otomatis saat sesi berhasil diinisialisasi.
 */
export class MessageClient {
    private whatsappClient?: WhatsappClient;
    private session: WASocket | null = null;
    private pendingMessageQueue: PendingMessage[] = [];

    constructor(client?: WhatsappClient) {
        if (client) {
            this.initialize(client);
        }
    }

    // =================================================================================
    // Metode Utama (Instance Methods) - Terkait dengan state/instance kelas
    // =================================================================================

    /**
     * Menginisialisasi client dengan sesi WhatsApp yang aktif dan
     * memproses semua pesan yang ada di antrian.
     * @param client Instance WhatsappClient yang sudah terkoneksi.
     */
    public initialize(client: WhatsappClient): void {
        this.whatsappClient = client;
        this.session = client.getSession();
        this.processPendingMessageQueue(); // Langsung proses antrian setelah inisialisasi
    }

    /**
     * Mengirim pesan ke JID (nomor WhatsApp) tujuan.
     * Jika sesi belum siap, pesan akan dimasukkan ke dalam antrian.
     * @param recipientJid JID penerima (e.g., "6281234567890@s.whatsapp.net").
     * @param content Isi pesan yang akan dikirim.
     * @param options Opsi tambahan untuk pengiriman pesan.
     */
    public async sendMessage(
        recipientJid: string,
        content: AnyMessageContent,
        options?: MiscMessageGenerationOptions,
    ): Promise<void> {

        if (!this.session) {
            this.pendingMessageQueue.push({
                timestamp: Date.now(),
                recipientJid,
                content,
                options,
            });
            logger.warn(`Session not ready. Message to ${recipientJid} queued.`);
            return;
        }

        try {
            await this.session.sendMessage(recipientJid, content, options);
        } catch (error) {
            logger.error(`Failed to send message to ${recipientJid}:`, error);
        }
    }

    /**
     * Memproses dan mengirim semua pesan yang ada di dalam antrian.
     * Pesan yang gagal dikirim akan dimasukkan kembali ke antrian.
     */
    private async processPendingMessageQueue(): Promise<void> {
        if (!this.session) {
            logger.warn("Cannot process message queue: session is not available.");
            return;
        }

        const messagesToSend = [...this.pendingMessageQueue];
        this.pendingMessageQueue = [];

        logger.info(`Processing ${messagesToSend.length} pending messages...`);

        for (const msg of messagesToSend) {
            try {
                await this.session.sendMessage(msg.recipientJid, msg.content, msg.options);
            } catch (error) {
                logger.error("Failed to send pending message, re-queuing:", error);
                this.pendingMessageQueue.push(msg);
            }
        }
    }

    /**
     * Mengembalikan jumlah pesan yang sedang dalam antrian.
     * @returns Jumlah pesan yang tertunda.
     */
    public getPendingMessageCount(): number {
        return this.pendingMessageQueue.length;
    }


    // =================================================================================
    // Metode Utilitas (Static Methods) - Fungsi pembantu, tidak butuh state
    // =================================================================================

    /**
     * Mengurai konten pesan dari wrapper 'ephemeralMessage' (pesan sementara).
     * @param message Objek pesan lengkap dari Baileys.
     * @returns Konten pesan asli atau undefined.
     */
    public static getUnwrappedMessageContent(message: proto.IWebMessageInfo): proto.IMessage | undefined | null {
        return message.message?.ephemeralMessage?.message || message.message;
    }

    /**
     * Mengekstrak teks dari berbagai jenis format pesan.
     * @param message Objek pesan lengkap dari Baileys.
     * @returns Teks yang diekstrak atau string kosong.
     */
    public static getMessageText(message: proto.IWebMessageInfo): string {
        const content = this.getUnwrappedMessageContent(message);
        if (!content) return "";

        return (
            content.buttonsResponseMessage?.selectedDisplayText ||
            content.listResponseMessage?.singleSelectReply?.selectedRowId ||
            content.templateButtonReplyMessage?.selectedDisplayText ||
            content.extendedTextMessage?.text ||
            content.imageMessage?.caption ||
            content.videoMessage?.caption ||
            content.documentWithCaptionMessage?.message?.documentMessage?.caption ||
            content.documentMessage?.caption ||
            content.conversation || ""
        );
    }

    /**
     * Mengekstrak JID yang di-mention dalam sebuah pesan.
     * @param message Objek pesan lengkap dari Baileys.
     * @returns Array berisi JID yang di-mention.
     */
    public static extractMentionedJids(message: proto.IWebMessageInfo): string[] {
        const content = this.getUnwrappedMessageContent(message);
        const contextInfo =
            content?.extendedTextMessage?.contextInfo ||
            content?.imageMessage?.contextInfo ||
            content?.videoMessage?.contextInfo ||
            content?.documentMessage?.contextInfo ||
            content?.documentWithCaptionMessage?.message?.documentMessage?.contextInfo;

        return contextInfo?.mentionedJid || [];
    }

    /**
    * Melakukan normalisasi pesan untuk memastikan konsistensi struktur.
    * @param message Objek pesan lengkap dari Baileys.
    * @returns Objek pesan yang telah dinormalisasi.
    */
    public static normalizeMessage(msg: proto.IWebMessageInfo) {

        let res = this.getUnwrappedMessageContent(msg);

        if (res?.documentWithCaptionMessage?.message) {
            const docMsg = res.documentWithCaptionMessage.message.documentMessage;
            if (docMsg) {
                res.documentMessage = docMsg;
                if (docMsg.caption) {
                    res.conversation = docMsg.caption;
                }
            }
            delete res.documentWithCaptionMessage;
        }
        return res!;
    }

    public static handleAttachmentMessage(filePath: string, text: string) {

        let options: AnyMessageContent = {
            text: ""
        }

        if (fs.existsSync(filePath) && filePath) {
            const buffer = fs.readFileSync(filePath);
            const mimeType = mime.lookup(filePath) || "application/octet-stream";
            const fileName = filePath.split(/[\\/]/).pop() || "file";
            if (mimeType.startsWith("image/")) {
                options = {
                    image: buffer,
                    caption: text
                };
            } else if (mimeType.startsWith("video/")) {
                options = {
                    video: buffer,
                    caption: text
                };
            } else if (mimeType.startsWith("audio/")) {
                options = {
                    audio: buffer,
                    mimetype: mimeType
                };
            } else {
                options = {
                    document: buffer,
                    mimetype: mimeType,
                    fileName: fileName,
                    caption: text
                };
            }
            return options
        } else {
            logger.error(`Attachment file not found`);
        }
    }
}