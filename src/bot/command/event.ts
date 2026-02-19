import fs from 'fs';
import path from 'path';
import { prefix } from "../../shared/constant/env";
import { CommandType } from "../type/client";
import { ChalangeType } from '../type/chalange';
import db from '../../database';
import { chalangeStudent } from '../../database/schema';
import { eq, sql } from 'drizzle-orm';

export default {
    name: "event",
    usage: `${prefix}event`,
    description: "Menampilkan informasi detail mengenai tantangan yang sedang berlangsung",
    execute: async (msg, client) => {
        const remoteJid = msg.key?.remoteJid!;
        const currentChalangePath = path.resolve(process.cwd(), 'assets', 'chalange.json');

        if (!fs.existsSync(currentChalangePath)) {
            return client.messageClient.sendMessage(remoteJid, { 
                text: '❌ *Kesalahan Sistem:* File konfigurasi tantangan tidak ditemukan. Silakan hubungi administrator.' 
            });
        }

        let changelog: ChalangeType;
        try {
            changelog = JSON.parse(fs.readFileSync(currentChalangePath, 'utf-8'));
        } catch (e) {
            return client.messageClient.sendMessage(remoteJid, { 
                text: '⚠️ *Kesalahan Sistem:* Gagal memproses data konfigurasi tantangan.' 
            });
        }

        const stats = await db.select({
            uniqueParticipants: sql<number>`count(distinct ${chalangeStudent.student_id})`,
            totalSubmissions: sql<number>`count(*)`,
            highScore: sql<number>`max(${chalangeStudent.score})`
        })
        .from(chalangeStudent)
        .where(eq(chalangeStudent.chalange_slug, changelog.slug));

        const participantCount = stats[0]?.uniqueParticipants || 0;
        const entryCount = stats[0]?.totalSubmissions || 0;
        const topScore = stats[0]?.highScore || 0;

        const deadline = new Date(changelog.due_date);
        const now = new Date();
        const isExpired = now > deadline;
        
        let timeLabel = "";
        if (!isExpired) {
            const diff = deadline.getTime() - now.getTime();
            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            timeLabel = `${days} Hari ${hours} Jam`;
        }

        let content = `📌 *INFORMASI EVENT: ${changelog.title.toUpperCase()}*\n`;
        content += `📝 *Deskripsi:* \n_${changelog.description}_\n\n`;

        content += `📊 *Statistik Terkini:* \n`;
        content += `└ 👥 Peserta Terdaftar: ${participantCount}\n`;
        content += `└ 📥 Total Laporan Masuk: ${entryCount}\n`;
        content += `└ 🏆 Skor Tertinggi: ${topScore ? topScore + ' pts' : 'Belum tersedia'}\n\n`;

        content += `🛠️ *Ketentuan:* \n`;
        content += `└ 📉 Rentang Skor: ${changelog.min_score} - ${changelog.max_score}\n`;
        content += `└ 🔄 Batas Percobaan: ${changelog.max_attempts} kali per peserta\n\n`;

        content += `🔗 *Tautan Instruksi:* \n${changelog.instruction_url}\n`;
        
        if (isExpired) {
            content += `⚠️ *STATUS:* Periode tantangan telah berakhir.`;
        } else {
            content += `⏳ *Sisa Waktu:* ${timeLabel}\n`;
            content += `🚀 *STATUS:* Aktif. Silakan berpartisipasi sebelum batas waktu berakhir.`;
        }

        await client.messageClient.sendMessage(remoteJid, { text: content });
    }
} as CommandType