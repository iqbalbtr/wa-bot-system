import fs from 'fs';
import path from 'path';
import { eventGroupId, prefix } from "../../shared/constant/env";
import { CommandType } from "../type/client";
import db from '../../database';
import { ChalangeType } from '../type/chalange';
import { eq, sql, InferSelectModel, asc, desc, and } from 'drizzle-orm';
import { chalangeStudent, student } from '../../database/schema';
import { downloadMediaMessage, proto } from 'baileys';
import { google_drive } from '../core/google-drive';
import Stream from 'stream';

async function recordSubmission(userId: number, slug: string, score: number, image: Stream.Transform, nim: string) {
    const target_folder_id = await google_drive.getTargetFolder([slug, nim]);

    let newname = new Date().toLocaleString("id-ID", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
    })

    const attachment = await google_drive.uploadImageFromStream(image, `${newname}.png`, target_folder_id);

    await db.insert(chalangeStudent).values({
        student_id: userId,
        chalange_slug: slug,
        attachment: `https://drive.google.com/file/d/${attachment.id}/view`,
        score,
        last_updated: new Date().toISOString()
    });
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

        if (!image) {
            return client.messageClient.sendMessage(remoteJid, { text: `⚠️ *Format Salah:* Kirim gambar. Contoh: *${prefix}submit*` });
        }

        let extraScore = chall.default_score || 0;

        let startTime = new Date(chall.start_date).getTime();

        for (const extra of chall.extra_score_in_days) {
            const extraTime = startTime + (extra.days_before * 24 * 60 * 60 * 1000);
            if (Date.now() <= extraTime) {
                extraScore += extra.score;
            } else {
                break;
            }
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

            const image = await downloadMediaMessage(msg, "stream", {})
            await recordSubmission(user.id, chall.slug, extraScore, image, user.nim);

            const currentTop = await db
                .select({
                    score: sql<number>`sum(${chalangeStudent.score})`,
                    name: student.name,
                    nick: student.nick,
                    nim: student.nim
                })
                .from(chalangeStudent)
                .innerJoin(student, eq(chalangeStudent.student_id, student.id))
                .where(eq(chalangeStudent.chalange_slug, chall.slug))
                .groupBy(student.id, student.nim)
                .orderBy(desc(sql`sum(${chalangeStudent.score})`))
                .limit(6);

            const userRankIndex = currentTop.findIndex(std => std.nim === user.nim);
            const currentUser = currentTop[userRankIndex];

            if (userRankIndex !== -1) {
                const userCurrentRank = userRankIndex + 1;
                const displacedUser = currentTop[userRankIndex + 1];

                let responseText = `✅ *Submit Berhasil!*\nPenambahan skor *${extraScore}* tercatat. Saat ini Anda berada di peringkat *#${userCurrentRank}*.`;

                if (userCurrentRank === 1) {
                    await client.messageClient.sendMessage(remoteJid, { text: `${responseText}\nSelamat! Anda memimpin klasemen sementara.` });

                    let broadcastMsg = `📢 *PEMBARUAN LEADERBOARD*\n\n*${user.nick || user.name}* berhasil mengambil alih posisi pertama dengan jumlah skor *${currentUser.score} pts*!`;

                    if (displacedUser) {
                        broadcastMsg += `\n\n🥈 *Tergeser:* ${displacedUser.nick || displacedUser.name} (${displacedUser.score} pts)`;
                    }

                    await client.messageClient.sendMessage(eventGroupId, { text: `${broadcastMsg}\n\nCek peringkat lengkap melalui *${prefix}top*!` });
                } else {
                    await client.messageClient.sendMessage(remoteJid, { text: responseText });
                }
            } else {
                await client.messageClient.sendMessage(remoteJid, { text: `✅ *Submit Berhasil:* Skor Anda bertambah *${extraScore}* poin. Terus berjuang untuk masuk ke jajaran Top 5!` });
            }

        } catch (error) {
            console.error("[SUBMIT_ERROR]", error);
            await client.messageClient.sendMessage(remoteJid, { text: '❗ *Error:* Gagal memproses data.' });
        }
    }
} as CommandType;