import fs from 'fs';
import path from 'path';
import { eventGroupId, prefix } from "../../shared/constant/env";
import { CommandType } from "../type/client";
import db from '../../database';
import { ChalangeType } from '../type/chalange';
import { eq, sql, InferSelectModel, asc, desc, and } from 'drizzle-orm';
import { chalangeStudent, student } from '../../database/schema';
import { downloadMediaMessage, proto } from 'baileys';
import google_api from '../core/google_api/auth';
import Stream from 'stream';
import { getChalangeData } from '../../api/lib/util';

async function recordSubmission(userId: number, image: Stream.Transform, nim: string) {
    const chalange = getChalangeData();

    const target_folder_id = await google_api.drive.getTargetFolder([chalange.category, chalange.start_date, nim]);
   
    let newname = new Date().toLocaleString("id-ID", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
    })

    const attachment = await google_api.drive.uploadImageFromStream(image, `${newname}.png`, target_folder_id);

    await db.insert(chalangeStudent)
        .values({
            student_id: userId,
            attachment: `https://drive.google.com/file/d/${attachment.id}/view`,
            score: 0,
            last_updated: new Date().toISOString(),
            challange_category: chalange.category,
            challange_date: chalange.start_date,
            challange_title: chalange.title,
        })
        .onConflictDoUpdate({
            target: [chalangeStudent.student_id, chalangeStudent.challange_category, chalangeStudent.challange_date],
            set: {
                attachment: `https://drive.google.com/file/d/${attachment.id}/view`,
                last_updated: new Date().toISOString(),
            }
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

        const maxSizeMB = 15;
        const chall: ChalangeType = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

        if (new Date() > new Date(chall.due_date)) {
            return client.messageClient.sendMessage(remoteJid, { text: `⏰ *Batas Waktu Berakhir:* Periode submit telah ditutup.` });
        }

        let extFile = 'png';
        const file = payload.message?.imageMessage || payload.message?.documentMessage;
        const fileSize = payload.message?.imageMessage?.fileLength || payload.message?.documentMessage?.fileLength || 0;

        if (!file) {
            return client.messageClient.sendMessage(remoteJid, { text: `⚠️ *Format Salah:* Kirim gambar. Contoh: *${prefix}submit*` });
        }

        if (Number(fileSize) > maxSizeMB * 1024 * 1024) {
            return client.messageClient.sendMessage(remoteJid, { text: `⚠️ *Ukuran Terlalu Besar:* Maksimal ${maxSizeMB} MB.` });
        }

        if (payload.message?.documentMessage) {
            extFile = payload.message.documentMessage.mimetype?.split('/')[1] || 'png';
        }
        
        let extraScore = 0;

        try {
            const student_phone = payload.from.startsWith("62") ? payload.from : remoteJid.split("@")[0];
            const user = await db.query.student.findFirst({ where: (s, { eq }) => eq(s.phone, student_phone) });
            if (!user || !user.nim) {
                return client.messageClient.sendMessage(remoteJid, { text: `⚠️ *Akses Ditolak:* Silakan registrasi terlebih dahulu. !register` });
            }

            const attempts = await db.select().from(chalangeStudent)
                .where(and(
                    eq(chalangeStudent.student_id, user.id),
                    eq(chalangeStudent.challange_category, chall.category),
                    eq(chalangeStudent.challange_date, chall.start_date)
                ));
                
            if (attempts.length >= 1 && (attempts?.[0]?.score || 0) > 0) {
                return client.messageClient.sendMessage(remoteJid, { text: `❌ *Submit Gagal:* Anda sudah submit untuk tantangan ini atau skor anda sudah ada.` });
            }

            const image = await downloadMediaMessage(msg, "stream", {})
            await recordSubmission(user.id, image, user.nim);

            await client.messageClient.sendMessage(remoteJid, { text: `✅ *Submit Berhasil:* Skor Anda bertambah *${extraScore}* poin. Terus berjuang untuk masuk ke jajaran Top 5!` });

        } catch (error) {
            console.error("[SUBMIT_ERROR]", error);
            await client.messageClient.sendMessage(remoteJid, { text: '❗ *Error:* Gagal memproses data.' });
        }
    }
} as CommandType;