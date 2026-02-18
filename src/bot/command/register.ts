import { downloadMediaMessage, proto } from "baileys";
import { prefix } from "../../shared/constant/env";
import { CommandType } from "../type/client";
import { generateSessionFooterContent } from "../lib/util";
import db from "../../database";
import { student } from "../../database/schema";
import { eq } from "drizzle-orm";

export default {
    name: "register",
    description: "Printah untuk melakukan pendaftaran event monthly chalange",
    usage: `${prefix}register`,
    execute: async (message, client, payload) => {
        client.sessionManager.startOrAdvanceSession(message, 'register');
        const reply = generateSessionFooterContent("register");

        const isUserExist = await db.select().from(student).where(eq(student.phone, payload.from)).limit(1);

        if (isUserExist.length == 0) {
            await db.insert(student).values({
                phone: payload.from,
                name: null,
                nim: null
            });
        }

        const userData = await db.select().from(student).where(eq(student.phone, payload.from)).limit(1);

        let res = `Hai, kamu sudah terdaftar dengan nomor ${payload.from}.\n\n` +
            `Nama: ${userData[0].name || "Belum diisi"}\n` +
            `NIM: ${userData[0].nim || "Belum diisi"}\n\n`

        res += reply;

        client.messageClient.sendMessage(message.key?.remoteJid!, { text: res });
    },
    commands: [
        {
            name: "/nim",
            description: "Ubah nim kamu -> `/nim 2025xxxx`",
            usage: `${prefix}nim 2025xxxx`,
            execute: async (message, client, payload) => {
                await db.update(student).set({ nim: payload.text }).where(eq(student.phone, payload.from));
                const reply = generateSessionFooterContent("register");
                client.messageClient.sendMessage(message.key?.remoteJid!, { text: `NIM berhasil diperbarui!\n\n${reply}` });
            }
        },
        {
            name: "/nama",
            description: "Ubah nama kamu -> `/nama Jhon Doe`",
            usage: `${prefix}nama nama lengkap kamu`,
            execute: async (message, client, payload) => {
                await db.update(student).set({ name: payload.text }).where(eq(student.phone, payload.from));
                const reply = generateSessionFooterContent("register");
                client.messageClient.sendMessage(message.key?.remoteJid!, { text: `Nama berhasil diperbarui!\n\n${reply}` });
            }
        },
        {
            name: "/info",
            description: "Cek info pendaftaran kamu",
            usage: `${prefix}info`,
            execute: async (message, client, payload) => {
                const userData = await db.select().from(student).where(eq(student.phone, payload.from)).limit(1);
                const reply = generateSessionFooterContent("register");
                let res = ''
                if (userData.length == 0) {
                    res = `Data tidak ditemukan untuk nomor ${payload.from}.\n\n`
                } else {
                    res = `Hai, kamu sudah terdaftar dengan nomor ${payload.from}.\n\n` +
                        `Nama: ${userData[0].name || "Belum diisi"}\n` +
                        `NIM: ${userData[0].nim || "Belum diisi"}\n\n`
                }
                res += reply;

                client.messageClient.sendMessage(message.key?.remoteJid!, { text: res });
            }
        }
    ]
} as CommandType;