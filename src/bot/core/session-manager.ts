import { proto } from "baileys";
import { Client, CommandType, SessionUserType } from "../type/client";

/**
 * Mengelola sesi interaktif untuk setiap pengguna.
 * Sesi memungkinkan alur percakapan multi-langkah, seperti mengisi formulir atau navigasi menu.
 */
export class SessionManager {
    private userSessions: Map<string, SessionUserType> = new Map();
    private readonly client: Client;

    constructor(client: Client) {
        this.client = client;
    }

    // =================================================================================
    // Metode Publik (Public API)
    // =================================================================================

    /**
     * Memulai sesi baru atau melanjutkan sesi yang ada ke langkah berikutnya.
     * @param msg Objek pesan dari Baileys untuk mengidentifikasi pengguna.
     * @param commandName Nama command (langkah sesi) yang akan dituju.
     * @param data Data tambahan yang akan disimpan dalam sesi.
     */
    public startOrAdvanceSession(msg: proto.IWebMessageInfo, commandName: string, data?: object): void {
        const userId = this._getSenderJid(msg);
        if (!userId) return;

        const existingSession = this.userSessions.get(userId);
        const newPath = existingSession ? [...existingSession.current, commandName] : [commandName];
        
        const targetCommand = this._findCommandByPath(newPath);

        if (!targetCommand) {
            this.client.messageClient.sendMessage(msg.key?.remoteJid!, {
                text: "Maaf, sesi atau perintah tidak dapat ditemukan."
            });
            return;
        }

        this.userSessions.set(userId, {
            current: newPath,
            session: targetCommand,
            data: data || existingSession?.data || {},
        });
    }

    /**
     * Memperbarui data yang tersimpan dalam sesi aktif seorang pengguna.
     * @param msg Objek pesan dari Baileys.
     * @param data Objek data baru untuk disimpan.
     */
    public updateSessionData(msg: proto.IWebMessageInfo, data: object): void {
        const userId = this._getSenderJid(msg);
        if (!userId) return;

        const session = this.userSessions.get(userId);
        if (!session) return;

        session.data = { ...session.data, ...data };
        this.userSessions.set(userId, session);
    }
    
    /**
     * Mengembalikan sesi pengguna ke langkah sebelumnya.
     * @param msg Objek pesan dari Baileys.
     * @param stepsBerapa langkah ingin kembali (default 1).
     */
    public goBackInSession(msg: proto.IWebMessageInfo, steps: number = 1): void {
        const userId = this._getSenderJid(msg);
        if (!userId) return;

        const session = this.userSessions.get(userId);
        if (!session || steps <= 0 || session.current.length <= 1) {
            // Jika tidak ada sesi, atau tidak bisa kembali lagi, hapus sesi.
            this.endSessionForUser(msg);
            return;
        }

        const newPath = session.current.slice(0, -steps);
        if (newPath.length === 0) {
            this.userSessions.delete(userId);
            return;
        }

        const targetCommand = this._findCommandByPath(newPath);
        if (targetCommand) {
            this.userSessions.set(userId, {
                ...session,
                current: newPath,
                session: targetCommand,
            });
        } else {
            // Jika path menjadi tidak valid, hapus sesi untuk mencegah error.
            this.userSessions.delete(userId);
        }
    }

    /**
     * Mengambil data sesi aktif dari seorang pengguna.
     * @param userId JID pengguna.
     */
    public getUserSession(userId: string): SessionUserType | undefined {
        return this.userSessions.get(userId);
    }

    /**
     * Menghapus sesi aktif untuk seorang pengguna.
     * @param msg Objek pesan dari Baileys.
     */
    public endSessionForUser(msg: proto.IWebMessageInfo): void {
        const userId = this._getSenderJid(msg);
        if (userId) {
            this.userSessions.delete(userId);
        }
    }

    /**
     * Menghapus semua sesi yang sedang aktif.
     */
    public clearAllSessions(): void {
        this.userSessions.clear();
    }

    /**
     * Mengembalikan array berisi JID semua pengguna yang sedang memiliki sesi aktif.
     */
    public getActiveUserJids(): string[] {
        return Array.from(this.userSessions.keys());
    }

    // =================================================================================
    // Metode Privat (Helpers)
    // =================================================================================

    /**
     * Helper untuk mengekstrak JID pengirim dari objek pesan.
     * @param msg Objek pesan dari Baileys.
     * @returns JID pengirim atau null jika tidak ditemukan.
     */
    private _getSenderJid(msg: proto.IWebMessageInfo): string | null {
        return msg.key?.remoteJid?.endsWith("@g.us") 
            ? msg.key?.participant || null 
            : msg.key?.remoteJid || null;
    }

    /**
     * Helper untuk menavigasi dan menemukan objek command berdasarkan path (urutan nama command).
     * @param path Array nama command, contoh: ['menu', 'order'].
     * @returns Objek CommandType jika ditemukan, jika tidak maka undefined.
     */
    private _findCommandByPath(path: string[]): CommandType | undefined {
        if (path.length === 0) return undefined;

        let currentCommand: CommandType | undefined = this.client.commandManager.getCommand(path[0]);

        for (let i = 1; i < path.length; i++) {
            if (!currentCommand) return undefined;
            const nextCommandName = path[i];
            currentCommand = currentCommand.commands?.find(c => c.name === nextCommandName);
        }

        return currentCommand;
    }
}