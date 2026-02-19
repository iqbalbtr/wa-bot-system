import fs from 'fs';
import path from 'path';
import { prefix } from "../../shared/constant/env";
import { CommandType } from "../type/client";
import db from '../../database';
import { ChalangeType } from '../type/chalange';
import { asc, desc, eq, sql } from 'drizzle-orm';
import { chalangeStudent, student } from '../../database/schema';

export default {
    name: "top",
    usage: `${prefix}top`,
    description: "Menampilkan daftar 5 peserta dengan skor tertinggi pada tantangan saat ini",
    execute: async (msg, client) => {
        const remoteJid = msg.key?.remoteJid!;
        const currentChalangePath = path.resolve(process.cwd(), 'assets', 'chalange.json');

        if (!fs.existsSync(currentChalangePath)) {
            return client.messageClient.sendMessage(remoteJid, { 
                text: '❌ Gagal memuat data: File konfigurasi tidak ditemukan. Silakan hubungi administrator.' 
            });
        }

        let changelog: ChalangeType;
        try {
            changelog = JSON.parse(fs.readFileSync(currentChalangePath, 'utf-8'));
        } catch (e) {
            return client.messageClient.sendMessage(remoteJid, { 
                text: '⚠️ Kesalahan Sistem: Format file konfigurasi tidak valid atau rusak.' 
            });
        }

        const topFive = await db
            .select({
                score: sql<number>`max(${chalangeStudent.score})`,
                name: student.name,
                nick: student.nick,
            })
            .from(chalangeStudent)
            .innerJoin(student, eq(chalangeStudent.student_id, student.id))
            .where(eq(chalangeStudent.chalange_slug, changelog.slug))
            .groupBy(student.id, student.nim)
            .orderBy(changelog.order === 'asc' 
                ? asc(sql`max(${chalangeStudent.score})`) 
                : desc(sql`max(${chalangeStudent.score})`)
            )
            .limit(5);

        if (topFive.length === 0) {
            return client.messageClient.sendMessage(remoteJid, { 
                text: '📭 Informasi: Belum ada data partisipan yang tercatat untuk tantangan ini.' 
            });
        }

        let content = `🏆 *PERINGKAT 5 BESAR: ${changelog.title.toUpperCase()}*\n\n`;

        topFive.forEach((item, index) => {
            const rankEmoji = index === 0 ? '👑' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🏅';
            const displayName = item.nick || item.name || "Peserta Anonim";
            content += `${rankEmoji} *${displayName}* — ${item.score} poin\n`;
        });

        content += `\n_Data ini diambil berdasarkan perolehan skor tertinggi saat ini._`;

        await client.messageClient.sendMessage(remoteJid, { text: content });
    }
} as CommandType