import { downloadMediaMessage, proto } from "baileys";
import { prefix } from "../../shared/constant/env";
import { CommandType } from "../type/client";
import { saveFileToTemp } from "../../shared/lib/storage";
import { convertPdfToDocx } from "../../script/pdf2docx";
import { promises as fs } from "fs";
import logger from "../../shared/lib/logger";
import sharp from "sharp";
import path from "path";
import { PDFDocument } from "pdf-lib"
import { generateSessionFooterContent } from "../lib/util";

export default {
    name: "converter",
    description: "Convert a file to another format",
    usage: `${prefix}converter`,
    execute: (message, client) => {
        client.sessionManager.startOrAdvanceSession(message, 'converter');
        const reply = generateSessionFooterContent("converter");
        client.messageClient.sendMessage(message.key?.remoteJid!, { text: reply });
    },
    commands: [
        {
            name: "/pdf2docx",
            description: "Convert a PDF file to DOCX format",
            usage: `${prefix}pdf2docx kirim file pdf dengan caption ini.`,
            execute: async (message, client, payload) => {
                const session = client.getSession();
                if (!session || !message.key?.remoteJid) return;
                try {
                                        
                    if (payload?.message.documentMessage?.mimetype !== "application/pdf" || Number(payload?.message.documentMessage.fileLength) >=  60 * 1024 * 1024) {
                        await client.messageClient.sendMessage(message.key.remoteJid, { text: "Pastikan file PDF yang valid dan tidak lebih dari 60MB." });
                        return;
                    }
              
                    const media = await downloadMediaMessage(message, "buffer", {});

                    if (!media) {
                        await client.messageClient.sendMessage(message.key?.remoteJid!, { text: "Pastikan file PDF dikirim bersama commandnya" });
                        return;
                    }

                    const tempPath = saveFileToTemp(new Uint8Array(media), ["pdf"], ".pdf");
                    const outputDocx = tempPath.outputFolderFile.replace(".pdf", ".docx");

                    await convertPdfToDocx(tempPath.outputFolderFile, outputDocx);

                    const docxBuffer = await fs.readFile(outputDocx);
                    await client.messageClient.sendMessage(message.key.remoteJid, {
                        document: docxBuffer,
                        mimetype: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                        fileName: outputDocx.split(/[\\/]/).pop(),
                        caption: "Berhasil mengonversi PDF ke DOCX"
                    });


                } catch (error) {
                    await client.messageClient.sendMessage(message.key.remoteJid, { text: "Terjadi error saat mengonversi file" });
                    logger.warn("Converter error:", error);
                }
            }
        },
        {
            name: "/img2pdf",
            description: "Convert image to pdf",
            execute: async (message, client) => {
                const session = client.getSession();
                if (!session || !message.key?.remoteJid) return;

                const content = generateSessionFooterContent("converter", "/img2pdf")

                client.messageClient.sendMessage(message.key.remoteJid, { text: content })
                client.sessionManager.startOrAdvanceSession(message, '/img2pdf', { images: [] });

            },
            commands: [
                {
                    name: "/list",
                    description: "Tampilkan daftar gambar yang akan dikonversi",
                    execute: async (message, client, payload, data) => {
                        const session = client.getSession();
                        if (!session || !message.key?.remoteJid) return;

                        const images: string[] = data.images || [];

                        if (images.length === 0) {
                            client.messageClient.sendMessage(message.key.remoteJid, { text: "Belum ada gambar yang ditambahkan." });
                            return;
                        }

                        let replyContent = "Daftar gambar yang akan dikonversi:";
                        images.forEach((image, index) => {
                            replyContent += `\n${index + 1}. ${image.split(/[\\/]/).pop()}`;
                        });

                        client.messageClient.sendMessage(message.key.remoteJid, { text: replyContent });
                    }
                },
                {
                    name: "/add",
                    description: "Gunakan `/add` `[image]` untuk menambahkan gambar ke dalam dokumen",
                    execute: async (message, client, payload, data) => {
                        try {
                            if (!message.key?.remoteJid) return;

                            const isImage =
                                (payload.message.imageMessage && payload.message.imageMessage.mimetype?.startsWith("image/")) ||
                                (payload.message.documentMessage && payload.message.documentMessage.mimetype?.startsWith("image/"));

                            if (!isImage) {
                                client.messageClient.sendMessage(message.key.remoteJid, { text: "Pastikan file yang dikirim adalah gambar." });
                                return;
                            }

                            const fileLength =
                                payload.message.imageMessage?.fileLength ||
                                payload.message.documentMessage?.fileLength ||
                                0;

                            if (Number(fileLength) >= 25 * 1024 * 1024) {
                                client.messageClient.sendMessage(message.key.remoteJid, { text: "Ukuran gambar tidak boleh lebih dari 20MB." });
                                return;
                            }

                            const image = await downloadMediaMessage(message, "buffer", {});

                            if (!image) {
                                client.messageClient.sendMessage(message.key.remoteJid, { text: "Pastikan gambar juga dikirim bersama commandnya" });
                                return;
                            }

                            const outputPath = path.join(process.cwd(), "temp", 'img2pdf', payload.from, `Gambar ke ${data.images.length + 1}.jpg`);

                            await fs.mkdir(path.join(process.cwd(), "temp", 'img2pdf', payload.from), { recursive: true });

                            await sharp(image)
                                .resize({
                                    width: 2480,
                                    fit: 'inside',
                                    withoutEnlargement: true,
                                })
                                .withMetadata({
                                    density: 300,
                                })
                                .jpeg({
                                    quality: 80,
                                    progressive: true,
                                    mozjpeg: true,
                                })
                                .toFile(outputPath);

                            const newData: string[] = [...data.images, outputPath];

                            client.sessionManager.updateSessionData(message, { images: newData });

                            let replyContent = "Berikut daftar gambar";

                            for (let i = 0; i < newData.length; i++) {
                                replyContent += `\n${i + 1}. ${newData[i].split(/[\\/]/).pop()}`;
                            }

                            client.messageClient.sendMessage(message.key.remoteJid, { text: replyContent });
                        } catch (error) {
                            logger.warn("Converter error:", error);
                            client.messageClient.sendMessage(message.key.remoteJid!, { text: "Terjadi kesalahan saat menambahkan gambar" });
                        }
                    }
                },
                {
                    name: "/remove",
                    description: "Gunakan untuk menghapus gambar dari dokumen Contoh /remove (1)",
                    execute: async (message, client, payload, data) => {
                        try {
                            if (!message.key?.remoteJid) return;

                            await fs.unlink(data.images[Number(payload.text) - 1]);

                            const newData = (data.images as string[]).filter((_, index) => index !== Number(payload.text) - 1);

                            client.sessionManager.updateSessionData(message, { images: newData });

                            let replyContent = "Berikut daftar gambar"

                            for (let i = 0; i < newData.length; i++) {
                                replyContent += `\n${i + 1}. ${newData[i].split(/[\\/]/).pop()}`
                            }

                            client.messageClient.sendMessage(message.key.remoteJid, { text: replyContent })
                        } catch (error) {
                            logger.warn("Converter error:", error);
                            client.messageClient.sendMessage(message.key.remoteJid!, { text: "Terjadi kesalahan saat menghapus gambar" });
                        }
                    }
                },
                {
                    name: "/clear",
                    description: "Gunakan /clear untuk menghapus semua gambar dari dokumen",
                    execute: async (message, client, payload, data) => {
                        try {

                            if (!message.key?.remoteJid) return;

                            for (const imagePath of data.images) {
                                await fs.unlink(imagePath);
                            }

                            client.sessionManager.updateSessionData(message, { images: [] });

                            client.messageClient.sendMessage(message.key.remoteJid, { text: "Semua gambar telah dihapus" })
                        } catch (error) {
                            logger.warn("Converter error:", error);
                            client.messageClient.sendMessage(message.key.remoteJid!, { text: "Terjadi kesalahan saat menghapus gambar" });
                        }
                    }
                },
                {
                    name: "/exec",
                    description: "Gunakan /exec  untuk mengeksekusi perintah",
                    execute: async (message, client, payload, data) => {
                        const session = client.getSession();
                        if (!session || !message.key?.remoteJid) return;

                        const pdfDoc = await PDFDocument.create();

                        for (const imagePath of data.images) {

                            const imageByte = await fs.readFile(imagePath);

                            const fileImage = await pdfDoc.embedJpg(new Uint8Array(imageByte));

                            const page = pdfDoc.addPage([fileImage.width, fileImage.height]);
                            page.drawImage(fileImage, {
                                x: 0,
                                y: 0,
                                width: fileImage.width,
                                height: fileImage.height,
                            });

                        }

                        const pdfBytes = await pdfDoc.save();

                        client.messageClient.sendMessage(message.key.remoteJid, {
                            document: Buffer.from(pdfBytes),
                            mimetype: "application/pdf",
                            fileName: "output.pdf",
                            caption: "PDF berhasil dibuat!"
                        });

                        for (const imagePath of data.images) {
                            await fs.unlink(imagePath);
                        }

                        client.sessionManager.updateSessionData(message, { images: [] });
                    }
                }
            ]
        }
    ]
} as CommandType;