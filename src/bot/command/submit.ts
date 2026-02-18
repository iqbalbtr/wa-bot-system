import fs from 'fs';
import path from 'path';
import { prefix } from "../../shared/constant/env";
import { CommandType } from "../type/client";
import db from '../../database';
import { ChalangeType } from '../type/chalange';
import { eq, sql, InferSelectModel } from 'drizzle-orm';
import { chalangeStudent, student } from '../../database/schema';
import { proto } from 'baileys';

async function submitAnswer(user: InferSelectModel<typeof student>, score: number, image: proto.Message.IImageMessage, chalange: ChalangeType, totalAttempts?: number) {
    console.log("Submitting answer =>", {
        user,
        score,
        image,
        chalange,
        totalAttempts
    })
    // kirim ke gdrive /slug/2025xxxx/x_score.jpg
}

export default {
    name: "submit",
    usage: `${prefix}submit 1212 [image]`,
    description: "Submit hasil kerjaan lu sebelum deadline",
    execute: async (msg, client, payload) => {
        const remoteJid = msg.key?.remoteJid!;
        const currentChalangePath = path.resolve(process.cwd(), 'assets', 'chalange.json');

        if (!fs.existsSync(currentChalangePath)) {
            return client.messageClient.sendMessage(remoteJid, { text: '❌ Config raib. Adminnya ngantuk.' });
        }

        let changelog: ChalangeType;
        try {
            changelog = JSON.parse(fs.readFileSync(currentChalangePath, 'utf-8'));
        } catch (e) {
            return client.messageClient.sendMessage(remoteJid, { text: '⚠️ JSON rusak. Ngetik pake hidung ya?' });
        }

        if (new Date() > new Date(changelog.due_date)) {
            return client.messageClient.sendMessage(remoteJid, { 
                text: `⏰ *TELAT!* Deadline: ${changelog.due_date}. Mending turu, jangan maksa.` 
            });
        }

        const image = payload.message.imageMessage;
        const score = parseInt(payload.text?.split(' ')[0] || "");

        if (!image || isNaN(score)) {
            return client.messageClient.sendMessage(remoteJid, { 
                text: `⚠️ Format sampah. Kirim gambar + caption: *${prefix}submit [angka]*` 
            });
        }

        if (score < (changelog.min_score || 0) || score > (changelog.max_score || 9999)) {
            return client.messageClient.sendMessage(remoteJid, { 
                text: `🚫 Skor *${score}* gak masuk akal. Min: ${changelog.min_score}, Max: ${changelog.max_score}. Lu mau nge-cheat?` 
            });
        }

        try {
            const user = await db.query.student.findFirst({
                where: (student, { eq }) => eq(student.phone, payload.from)
            });

            if (!user) {
                return client.messageClient.sendMessage(remoteJid, { text: '⚠️ Lu siapa? !register dulu, beban.' });
            }

            const submissionCount = await db
                .select({ count: sql<number>`count(*)` })
                .from(chalangeStudent)
                .where(eq(chalangeStudent.student_id, user.id));

            if (changelog.max_attempts && submissionCount[0].count >= changelog.max_attempts) {
                return client.messageClient.sendMessage(remoteJid, { 
                    text: `❌ Udah ${changelog.max_attempts}x submit. Jatah lu abis. Balik lagi bulan depan.` 
                });
            }

            await submitAnswer(user, score, image, changelog, submissionCount[0].count);

            await client.messageClient.sendMessage(remoteJid, { 
                text: `✅ Submit "${changelog.title}" aman. Score: ${score}. (Moga gak diperiksa admin 🗿)` 
            });

        } catch (error) {
            console.error(error);
            await client.messageClient.sendMessage(remoteJid, { text: '🔥 Backend meledak. Skill issue kodingan lu.' });
        }
    }
} as CommandType