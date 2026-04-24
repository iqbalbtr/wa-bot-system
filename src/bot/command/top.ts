import fs from 'fs';
import path from 'path';
import { prefix } from "../../shared/constant/env";
import { CommandType } from "../type/client";
import db from '../../database';
import { ChalangeType } from '../type/chalange';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { chalangeStudent, student } from '../../database/schema';
import { getChalangeData } from '../../api/lib/util';

export const getTop = async (remoteJid: string, category: string, date: string) => {

    const changelog = getChalangeData();

    const topFive = await db
        .select({
            score: sql<number>`sum(${chalangeStudent.score})`,
            name: student.name,
            nick: student.nick,
        })
        .from(chalangeStudent)
        .innerJoin(student, eq(chalangeStudent.student_id, student.id))
        .where(
            and(
                eq(chalangeStudent.challange_category, changelog.category),
                eq(chalangeStudent.challange_date, changelog.start_date)
            )
        )
        .groupBy(student.id, student.nim)
        .orderBy(desc(sql`sum(${chalangeStudent.score})`))
        .limit(5);

    if (topFive.length === 0) {
            return '📭 Informasi: Belum ada data partisipan yang tercatat untuk tantangan ini.'
    }

    let content = `🏆 *PERINGKAT 5 BESAR: ${changelog.title.toUpperCase()}*\n\n`;

    topFive.forEach((item, index) => {
        const rankEmoji = index === 0 ? '👑' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🏅';
        const displayName = item.nick || item.name || "Peserta Anonim";
        content += `${rankEmoji} *${displayName}* — ${item.score} poin\n`;
    });

    content += `\n_Data ini diambil berdasarkan perolehan skor tertinggi saat ini._`;

    return content;
}

export default {
    name: "top",
    usage: `${prefix}top`,
    description: "Menampilkan daftar 5 peserta dengan skor tertinggi pada tantangan saat ini",
    execute: async (msg, client) => {
        const remoteJid = msg.key?.remoteJid!;
        const chall = getChalangeData();
        const top = await getTop(remoteJid, chall.category, chall.start_date);
        return client.messageClient.sendMessage(remoteJid, {
            text: top
        });
    }
} as CommandType