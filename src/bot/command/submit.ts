import fs from 'fs';
import path from 'path';
import { eventGroupId, prefix } from "../../shared/constant/env";
import { CommandType } from "../type/client";
import db from '../../database';
import { ChalangeType } from '../type/chalange';
import { eq, sql, InferSelectModel, asc, desc, and } from 'drizzle-orm';
import { chalangeStudent, student } from '../../database/schema';
import { proto } from 'baileys';


async function recordSubmission(userId: number, slug: string, score: number) {
    await db.insert(chalangeStudent).values({
        student_id: userId,
        chalange_slug: slug,
        attachment: "static_storage/placeholder.jpg",
        score,
        last_updated: new Date().toISOString()
    });
    // kirim ke gdrive /slug/2025xxxx/x_score.jpg
}

export default {
    name: "submit",
    usage: `${prefix}submit [skor] [lampirkan_gambar]`,
    description: "Mengirimkan hasil capaian Monthly Challenge",
    execute: async (msg, client, payload) => {
        const remoteJid = msg.key?.remoteJid!;
        const configPath = path.resolve(process.cwd(), 'assets', 'chalange.json');

        if (!fs.existsSync(configPath)) {
            return client.messageClient.sendMessage(remoteJid, { text: '❌ *Sistem Error:* Konfigurasi tantangan tidak ditemukan.' });
        }

        const chall: ChalangeType = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

        if (new Date() > new Date(chall.due_date)) {
            return client.messageClient.sendMessage(remoteJid, { text: `⏰ *Batas Waktu Berakhir:* Periode submit telah ditutup.` });
        }

        const image = payload.message.imageMessage;
        const score = parseInt(payload.text?.split(' ')[0] || "");

        if (!image || isNaN(score)) {
            return client.messageClient.sendMessage(remoteJid, { text: `⚠️ *Format Salah:* Kirim gambar dengan caption angka skor. Contoh: *${prefix}submit 1200*` });
        }

        if (score < (chall.min_score || 0) || score > (chall.max_score || 9999)) {
            return client.messageClient.sendMessage(remoteJid, { text: `🚫 *Skor Tidak Valid:* Skor Anda di luar jangkauan (${chall.min_score} - ${chall.max_score}).` });
        }

        try {
            const user = await db.query.student.findFirst({ where: (s, { eq }) => eq(s.phone, payload.from) });
            if (!user || !user.nim) {
                return client.messageClient.sendMessage(remoteJid, { text: `⚠️ *Akses Ditolak:* Silakan registrasi terlebih dahulu. !register` });
            }

            const attempts = await db.select({ count: sql<number>`count(*)` }).from(chalangeStudent)
                .where(and(eq(chalangeStudent.student_id, user.id), eq(chalangeStudent.chalange_slug, chall.slug)));

            if (chall.max_attempts && attempts[0].count >= chall.max_attempts) {
                return client.messageClient.sendMessage(remoteJid, { text: `❌ *Batas Terlampaui:* Anda sudah submit ${attempts[0].count} kali.` });
            }

            await recordSubmission(user.id, chall.slug, score);

            const currentTop = await db
                .select({
                    score: sql<number>`max(${chalangeStudent.score})`,
                    name: student.name,
                    nick: student.nick,
                    nim: student.nim
                })
                .from(chalangeStudent)
                .innerJoin(student, eq(chalangeStudent.student_id, student.id))
                .where(eq(chalangeStudent.chalange_slug, chall.slug))
                .groupBy(student.id, student.nim)
                .orderBy(chall.order === 'asc' ? asc(sql`max(${chalangeStudent.score})`) : desc(sql`max(${chalangeStudent.score})`))
                .limit(6);

            const userRankIndex = currentTop.findIndex(std => std.nim === user.nim);

            if (userRankIndex !== -1) {
                const userCurrentRank = userRankIndex + 1;
                const displacedUser = currentTop[userRankIndex + 1];

                let responseText = `✅ *Submit Berhasil!*\nSkor *${score}* tercatat. Saat ini Anda berada di peringkat *#${userCurrentRank}*.`;

                if (userCurrentRank === 1) {
                    await client.messageClient.sendMessage(remoteJid, { text: `${responseText}\nSelamat! Anda memimpin klasemen sementara.` });

                    let broadcastMsg = `📢 *PEMBARUAN LEADERBOARD*\n\n*${user.nick || user.name}* berhasil mengambil alih posisi pertama dengan skor *${score} pts*!`;
                    
                    if (displacedUser) {
                        broadcastMsg += `\n\n🥈 *Tergeser:* ${displacedUser.nick || displacedUser.name} (${displacedUser.score} pts)`;
                    }

                    await client.messageClient.sendMessage(eventGroupId, { text: `${broadcastMsg}\n\nCek peringkat lengkap melalui *${prefix}top*!` });
                } else {
                    await client.messageClient.sendMessage(remoteJid, { text: responseText });
                }
            } else {
                await client.messageClient.sendMessage(remoteJid, { text: `✅ *Submit Berhasil:* Skor Anda adalah *${score}*. Terus berjuang untuk masuk ke jajaran Top 5!` });
            }

        } catch (error) {
            console.error("[SUBMIT_ERROR]", error);
            await client.messageClient.sendMessage(remoteJid, { text: '❗ *Error:* Gagal memproses data.' });
        }
    }
} as CommandType;