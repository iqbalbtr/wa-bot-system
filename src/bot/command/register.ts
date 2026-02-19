import { prefix } from "../../shared/constant/env";
import { CommandType } from "../type/client";
import { generateSessionFooterContent } from "../lib/util";
import db from "../../database";
import { student } from "../../database/schema";
import { eq } from "drizzle-orm";

export default {
    name: "register",
    description: "Inisialisasi diri lu biar gak jadi user ghaib",
    usage: `${prefix}register`,
    execute: async (message, client, payload) => {
        const remoteJid = message.key?.remoteJid!;
        client.sessionManager.startOrAdvanceSession(message, 'register');
        const footer = generateSessionFooterContent("register");

        const existingUser = await db.select().from(student).where(eq(student.phone, payload.from)).limit(1);

        if (existingUser.length === 0) {
            await db.insert(student).values({
                phone: payload.from,
                name: null,
                nick: null,
                nim: null
            });
        }

        const user = (await db.select().from(student).where(eq(student.phone, payload.from)).limit(1))[0];

        let res = `👤 *PROFILE AUTH: ${payload.from}*\n`;
        res += `📑 Nama: ${user.name || "_Belum diisi (Skill issue)_"}\n`;
        res += `🎭 Nick: ${user.nick || "_Belum diisi (User misterius)_"}\n`;
        res += `🆔 NIM: ${user.nim || "_Belum diisi (Drop out?)_"}\n\n`;
        res += `*Input data lu pake command di bawah ini:*\n`;
        res += footer;

        client.messageClient.sendMessage(remoteJid, { text: res });
    },
    commands: [
        {
            name: "/nim",
            description: "Set NIM lu",
            usage: `${prefix}nim [9 digit angka]`,
            execute: async (message, client, payload) => {
                const remoteJid = message.key?.remoteJid!;
                const input = payload.text.trim();

                if(!/^\d{9}$/.test(input)) {
                    return client.messageClient.sendMessage(remoteJid, { 
                        text: `⚠️ NIM apaan tuh? Harus *9 digit angka*. Lu mahasiswa beneran bukan?` 
                    });
                }

                await db.update(student).set({ nim: input }).where(eq(student.phone, payload.from));
                const footer = generateSessionFooterContent("register");
                client.messageClient.sendMessage(remoteJid, { text: `✅ NIM update: *${input}*. Sip, gak jadi DO.\n\n${footer}` });
            }
        },
        {
            name: "/nama",
            description: "Set nama lengkap lu",
            usage: `${prefix}nama [nama lengkap]`,
            execute: async (message, client, payload) => {
                const remoteJid = message.key?.remoteJid!;
                const input = payload.text.trim();

                if (input.length < 3 || input.length > 50) {
                    return client.messageClient.sendMessage(remoteJid, { 
                        text: `⚠️ Nama lu kependekan atau kepanjangan. 3-50 karakter aja, gak usah curhat.` 
                    });
                }

                await db.update(student).set({ name: input }).where(eq(student.phone, payload.from));
                const footer = generateSessionFooterContent("register");
                client.messageClient.sendMessage(remoteJid, { text: `✅ Nama lu sekarang: *${input}*.\n\n${footer}` });
            }
        },
        {
            name: "/nick",
            description: "Set nickname anonymous lu",
            usage: `${prefix}nick [nickname]`,
            execute: async (message, client, payload) => {
                const remoteJid = message.key?.remoteJid!;
                const input = payload.text.trim();

                if (input.length < 2 || input.length > 15) {
                    return client.messageClient.sendMessage(remoteJid, { 
                        text: `⚠️ Nickname itu singkat! 2-15 karakter. Jangan bikin nama kayak judul skripsi.` 
                    });
                }

                await db.update(student).set({ nick: input }).where(eq(student.phone, payload.from));
                const footer = generateSessionFooterContent("register");
                client.messageClient.sendMessage(remoteJid, { text: `✅ Nick lu ganti jadi *${input}*. Awas aja kalo tetep cupu.\n\n${footer}` });
            }
        },
        {
            name: "/info",
            description: "Intip status pendaftaran",
            usage: `${prefix}info`,
            execute: async (message, client, payload) => {
                const userData = await db.select().from(student).where(eq(student.phone, payload.from)).limit(1);
                const footer = generateSessionFooterContent("register");
                
                if (userData.length == 0) {
                    return client.messageClient.sendMessage(message.key?.remoteJid!, { text: `🚫 Data lu gak ada di database. !register dulu gih.` });
                }

                const user = userData[0];
                let res = `📑 *CURRENT INFO: ${user.nick || 'User'}*\n`;
                res += `👤 Name: ${user.name || "N/A"}\n`;
                res += `🆔 NIM: ${user.nim || "N/A"}\n`;
                res += `🎭 Nick: ${user.nick || "N/A"}\n`;
                res += `📱 Phone: ${user.phone}\n\n`;
                res += footer;

                client.messageClient.sendMessage(message.key?.remoteJid!, { text: res });
            }
        }
    ]
} as CommandType;