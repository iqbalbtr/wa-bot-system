import { devId, prefix } from "../../shared/constant/env";
import { CommandType } from "../type/client";
import { downloadMediaMessage } from "baileys";
import logger from "../../shared/lib/logger";
import { generateSessionFooterContent } from "../lib/util";

export default {
    name: "req",
    usage: `${prefix}req`,
    description: "Kirim masukan ke developer",
    async execute(message, client) {

        let content = 'Pesan akan diforward ke developer\nHarap tidak melakukan spam\n'
        content += generateSessionFooterContent('req');
        client.sessionManager.startOrAdvanceSession(message, 'req')

        client.messageClient.sendMessage((message.key.remoteJid || ""), {
            text: content
        });
    },
    commands: [
        {
            name: "/bug",
            description: `${prefix}bug [pesan] | Kirim pesan jika menemukan bug, anda bisa menyertakan gambar jika ada`,
            execute: async (message, client, payload) => {

                if (!message.key?.remoteJid) return;

                try {
                    let media = null;
                    let messageText = payload.text || "";

                    if (payload.message.imageMessage || payload.message?.documentMessage) {
                        media = await downloadMediaMessage(message, 'buffer', {});
                    }

                    const userJid = message.key.remoteJid;
                    const bugContent = messageText.split('/bug')[1]?.trim() || "Tidak ada deskripsi";

                    let content = `Type : Bug\nPesan dari : ${userJid}\nIsi : ${bugContent}`;

                    if (media) {
                        if (payload.message?.imageMessage) {
                            await client.messageClient.sendMessage(devId, {
                                image: media,
                                caption: content
                            });
                        } else if (payload.message?.documentMessage) {
                            await client.messageClient.sendMessage(devId, {
                                document: media,
                                caption: content,
                                fileName: payload.message.documentMessage.fileName || "bug_report",
                                mimetype: payload.message.documentMessage.mimetype || "application/octet-stream"
                            });
                        }
                    } else {
                        await client.messageClient.sendMessage(devId, { text: content });
                    }

                    await client.messageClient.sendMessage(userJid, {
                        text: 'Laporan bug berhasil dikirim ke developer'
                    });

                } catch (error) {
                    logger.warn("Req error:", error);
                    if (message.key?.remoteJid) {
                        await client.messageClient.sendMessage(message.key.remoteJid, {
                            text: 'Gagal mengirim laporan bug'
                        });
                    }
                }
            }
        },
        {
            name: "/req",
            description: `${prefix}req [pesan] | Kirim pesan jika memiliki masukan`,
            execute: async (message, client, payload) => {

                if (!message.key?.remoteJid) return;

                try {
                    let media = null;
                    let messageText = payload.text || "";

                    if (payload.message?.imageMessage || payload.message?.documentMessage) {
                        media = await downloadMediaMessage(message, 'buffer', {});
                    }

                    const userJid = message.key.remoteJid;
                    const reqContent = messageText.split('/req')[1]?.trim() || "Tidak ada masukan";

                    let content = `Type : Masukan\nPesan dari : ${userJid}\nIsi : ${reqContent}`;

                    if (media) {
                        if (payload.message?.imageMessage) {
                            await client.messageClient.sendMessage(devId, {
                                image: media,
                                caption: content
                            });
                        } else if (payload.message?.documentMessage) {
                            await client.messageClient.sendMessage(devId, {
                                document: media,
                                caption: content,
                                fileName: payload.message.documentMessage.fileName || "user_feedback",
                                mimetype: payload.message.documentMessage.mimetype || "application/octet-stream"
                            });
                        }
                    } else {
                        await client.messageClient.sendMessage(devId, { text: content });
                    }

                    await client.messageClient.sendMessage(userJid, {
                        text: 'Masukan berhasil dikirim ke developer'
                    });

                } catch (error) {
                    logger.warn("Req error:", error);
                    if (message.key?.remoteJid) {
                        await client.messageClient.sendMessage(message.key.remoteJid, {
                            text: 'Gagal mengirim masukan'
                        });
                    }
                }
            }
        }
    ]
} as CommandType