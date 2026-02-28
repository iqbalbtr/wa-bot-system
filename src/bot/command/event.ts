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
                text: '❌ *Sistem Error:* Data tantangan tidak ditemukan.'
            });
        }

        let changelog: ChalangeType
        try {
            changelog = JSON.parse(fs.readFileSync(currentChalangePath, 'utf-8'));
        } catch (e) {
            return client.messageClient.sendMessage(remoteJid, {
                text: '⚠️ *Sistem Error:* Gagal memuat konfigurasi event.'
            });
        }

        const stats: any = await db.select({
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
            timeLabel = `⏳ *Deadline:* ${days} Hari, ${hours} Jam lagi`;
        }

        let content = `*🏆 EVENT CHALLENGE*\n\n`;

        content += `📌 *TOPIC:* ${changelog.category || 'General'}\n`;
        content += `🔥 *TITLE:* _${changelog.title.toUpperCase()}_\n`;

        content += `📝 *DESKRIPSI:*\n`;
        content += `"${changelog.description}"\n\n`;

        content += `📢 *PESAN ADMIN:*\n`;
        content += `_${changelog.message}_\n\n`;

        content += `📊 *STATISTIK LIVE:*\n`;
        content += `┌ 👥 *Peserta:* ${participantCount} Member\n`;
        content += `├ 📥 *Total Entry:* ${entryCount} Laporan\n`;
        content += `└ 🏅 *Top Score:* ${topScore ? topScore + ' pts' : 'Belum ada'}\n\n`;

        content += `⚙️ *KETENTUAN & BONUS:*\n`;
        content += `├ 🔄 *Limit:* Max ${changelog.max_attempts}x Submit\n`;

        const sortedBonus = [...changelog.extra_score_in_days].sort((a, b) => a.days_before - b.days_before);
        for (const extra of sortedBonus) {
            content += `├ ⚡ *+${extra.score} pts:* Submit dlm ${extra.days_before} hari pertama\n`;
        }
        content += `└ 💡 _Base Score: ${changelog.default_score} pts_\n\n`;

        content += `🔗 *LINK PENTING:*\n`;
        content += `├ *Panduan:* ${changelog.instruction_url}\n`;
        content += `├ *Materi:* ${changelog.challenge_instruction}\n`;
        content += `└ *Portal:* ${changelog.submission_url}\n\n`;

        if (isExpired) {
            content += `🔴 *STATUS:* Periode telah berakhir.`;
        } else {
            content += `${timeLabel}\n`;
            content += `🟢 *STATUS:* Event Aktif! Gunakan \`${prefix}submit\` untuk mengirim bukti.`;
        }

        await client.messageClient.sendMessage(remoteJid, { text: content });
    }
} as CommandType;