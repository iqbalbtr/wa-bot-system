import { prefix } from "../../shared/constant/env";
import { CommandType } from "../type/client";
import { generateSessionFooterContent } from "../lib/util";
import db from "../../database";
import { chalangeStudent, student } from "../../database/schema";
import { and, eq, sql } from "drizzle-orm";
import path from "path";
import { ChalangeType } from "../type/chalange";
import fs from "fs";

export default {
    name: "register",
    description: "Mendaftarkan profil Anda ke dalam sistem",
    usage: `${prefix}register`,
    execute: async (message, client, payload) => {
        const remoteJid = message.key?.remoteJid!;
        client.sessionManager.startOrAdvanceSession(message, 'register');
        const footer = generateSessionFooterContent("register");

        const existingUser = await db.select().from(student).where(eq(student.phone, payload.from)).limit(1);

        const configPath = path.resolve(process.cwd(), 'assets', 'chalange.json');
        const chall: ChalangeType = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

        const totalScore = await db.select({
            totalScore: sql<number>`sum(${chalangeStudent.score})`
        })
            .from(chalangeStudent)
            .where(eq(chalangeStudent.student_id, existingUser[0]?.id || 0));
            
        const currentScore = await db.select({
            score: sql<number>`sum(${chalangeStudent.score})`
        })
            .from(chalangeStudent)
            .where(and(
                eq(chalangeStudent.student_id, existingUser[0]?.id || 0),
                eq(chalangeStudent.chalange_slug, chall.slug)
            ));

        if (existingUser.length === 0) {
            await db.insert(student).values({
                phone: payload.from,
                name: null,
                nick: null,
                nim: null
            });
        }

        const user = (await db.select().from(student).where(eq(student.phone, payload.from)).limit(1))[0];

        let res = `👤 *PROFIL AUTENTIKASI: ${payload.from}*\n`;
        res += `📑 Nama: ${user.name || "_Belum diisi_"}\n`;
        res += `🎭 Nick: ${user.nick || "_Belum diisi_"}\n`;
        res += `🆔 NIM: ${user.nim || "_Belum diisi_"}\n\n`;
        res += `📊 *SKOR ANDA: ${totalScore[0].totalScore || 0} pts* (Skor untuk tantangan saat ini: ${currentScore[0]?.score || 0} pts)\n\n`;
        res += `*Silakan isi data Anda menggunakan perintah berikut:*\n`;
        res += footer;

        client.messageClient.sendMessage(remoteJid, { text: res });
    },
    commands: [
        {
            name: "/nim",
            description: "Set NIM",
            usage: `${prefix}nim [9 digit angka]`,
            execute: async (message, client, payload) => {
                const remoteJid = message.key?.remoteJid!;
                const input = payload.text.trim();

                if (!/^\d{9}$/.test(input)) {
                    return client.messageClient.sendMessage(remoteJid, {
                        text: `⚠️ Format NIM tidak valid. Harus terdiri dari *9 digit angka*.`
                    });
                }

                await db.update(student).set({ nim: input }).where(eq(student.phone, payload.from));
                const footer = generateSessionFooterContent("register");
                client.messageClient.sendMessage(remoteJid, { text: `✅ NIM berhasil diperbarui: *${input}*.\n\n${footer}` });
            }
        },
        {
            name: "/nama",
            description: "Set nama lengkap",
            usage: `${prefix}nama [nama lengkap]`,
            execute: async (message, client, payload) => {
                const remoteJid = message.key?.remoteJid!;
                const input = payload.text.trim();

                if (input.length < 3 || input.length > 50) {
                    return client.messageClient.sendMessage(remoteJid, {
                        text: `⚠️ Nama harus terdiri dari 3-50 karakter.`
                    });
                }

                await db.update(student).set({ name: input }).where(eq(student.phone, payload.from));
                const footer = generateSessionFooterContent("register");
                client.messageClient.sendMessage(remoteJid, { text: `✅ Nama berhasil diperbarui: *${input}*.\n\n${footer}` });
            }
        },
        {
            name: "/nick",
            description: "Set nickname anonymous",
            usage: `${prefix}nick [nickname]`,
            execute: async (message, client, payload) => {
                const remoteJid = message.key?.remoteJid!;
                const input = payload.text.trim();

                if (input.length < 2 || input.length > 15) {
                    return client.messageClient.sendMessage(remoteJid, {
                        text: `⚠️ Nickname harus terdiri dari 2-15 karakter.`
                    });
                }

                await db.update(student).set({ nick: input }).where(eq(student.phone, payload.from));
                const footer = generateSessionFooterContent("register");
                client.messageClient.sendMessage(remoteJid, { text: `✅ Nickname berhasil diperbarui: *${input}*.\n\n${footer}` });
            }
        },
        {
            name: "/info",
            description: "status pendaftaran",
            usage: `${prefix}info`,
            execute: async (message, client, payload) => {
                const userData = await db.select().from(student).where(eq(student.phone, payload.from)).limit(1);
                const footer = generateSessionFooterContent("register");

                if (userData.length == 0) {
                    return client.messageClient.sendMessage(message.key?.remoteJid!, { text: `🚫 Data Anda tidak ditemukan. Silakan daftarkan diri terlebih dahulu.` });
                }

                const configPath = path.resolve(process.cwd(), 'assets', 'chalange.json');
                const chall: ChalangeType = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

                const totalScore = await db.select({
                    totalScore: sql<number>`sum(${chalangeStudent.score})`
                })
                    .from(chalangeStudent)
                    .where(eq(chalangeStudent.student_id, userData[0]?.id || 0));
                const currentScore = await db.select({
                    score: sql<number>`sum(${chalangeStudent.score})`
                })
                    .from(chalangeStudent)
                    .where(and(
                        eq(chalangeStudent.student_id, userData[0]?.id || 0),
                        eq(chalangeStudent.chalange_slug, chall.slug)
                    ));

                if (userData.length === 0) {
                    await db.insert(student).values({
                        phone: payload.from,
                        name: null,
                        nick: null,
                        nim: null
                    });
                }

                const user = userData[0];
                let res = `📑 *INFORMASI PROFIL: ${user.nick || 'Pengguna'}*\n`;
                res += `👤 Nama: ${user.name || "N/A"}\n`;
                res += `🆔 NIM: ${user.nim || "N/A"}\n`;
                res += `🎭 Nickname: ${user.nick || "N/A"}\n`;
                res += `📱 Ponsel: ${user.phone}\n\n`;
                res += `📊 *SKOR ANDA: ${totalScore[0].totalScore || 0} pts* (Skor untuk tantangan saat ini: ${currentScore[0]?.score || 0} pts)\n\n`;
                res += footer;

                client.messageClient.sendMessage(message.key?.remoteJid!, { text: res });
            }
        }
    ]
} as CommandType;