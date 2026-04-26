import path from "path";
import fs from "fs";
import { childProcessCallback } from "../../shared/lib/util";
import { CommandType } from '../type/client';
import logger from '../../shared/lib/logger';
import { generateSessionFooterContent } from '../lib/util';

export default {
    name: "downloader",
    description: "Alat pengunduh video media sosial",
    execute: async (message, client) => {
        if (!message.key?.remoteJid) return;
        let content = generateSessionFooterContent('downloader');
        client.sessionManager.startOrAdvanceSession(message, 'downloader');
        await client.messageClient.sendMessage(message.key.remoteJid, { text: content });
    },
    commands: [
        {
            name: "/yt",
            description: "Cek dan tampilkan link download video YouTube dalam berbagai format (tanpa download langsung)",
            execute: async (message, client, payload) => {
                if (!message.key?.remoteJid) return;
                const link = payload.text.trim();
                if (!link) {
                    await client.messageClient.sendMessage(message.key.remoteJid, { text: 'Link tidak ditemukan' });
                    return;
                }
                const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/;
                if (!youtubeRegex.test(link)) {
                    await client.messageClient.sendMessage(message.key.remoteJid, { text: 'Link bukan link YouTube yang valid.' });
                    return;
                }
                try {

                    const res = await childProcessCallback("yt-dlp", "-j", link);
                    const jsonStr = res.join("");
                    type YtDlpFormat = {
                        url: string;
                        ext: string;
                        format_id?: string;
                        format_note?: string;
                        filesize?: number;
                        filesize_approx?: number;
                        height?: number;
                        tbr?: number;
                        vcodec?: string;
                    };
                    type YtDlpInfo = {
                        title?: string;
                        formats: YtDlpFormat[];
                    };
                    let info: YtDlpInfo;
                    try {
                        info = JSON.parse(jsonStr);
                    } catch (e) {
                        await client.messageClient.sendMessage(message.key.remoteJid, { text: 'Gagal membaca info video.' });
                        return;
                    }
                    if (!info.formats || !Array.isArray(info.formats)) {
                        await client.messageClient.sendMessage(message.key.remoteJid, { text: 'Format video tidak ditemukan.' });
                        return;
                    }

                    const mp4Videos = info.formats.filter((f: YtDlpFormat) => f.url && f.ext === 'mp4' && f.format_note && !f.format_note.toLowerCase().includes('audio'));

                    const audioFormats = info.formats.filter((f: YtDlpFormat) => f.url && (f.ext === 'm4a' || f.ext === 'webm' || f.ext === 'mp3') && (f.format_note?.toLowerCase().includes('audio') || f.vcodec === 'none'));

                    const sorted = mp4Videos.sort((a, b) => (b.height || b.tbr || 0) - (a.height || a.tbr || 0));
                    const bestAudio = audioFormats.sort((a, b) => (b.tbr || 0) - (a.tbr || 0))[0];
                    if (mp4Videos.length === 0 && !bestAudio) {
                        await client.messageClient.sendMessage(message.key.remoteJid, { text: 'Tidak ada link video mp4 atau audio yang bisa ditampilkan.' });
                        return;
                    }

                    const best = sorted[0];
                    const standard = sorted[Math.floor(sorted.length / 2)];
                    const low = sorted[sorted.length - 1];
                    let content = `*${info.title || 'Video'}*\n\n`;
                    content += 'Link download video mp4 (video only):\n';
                    function formatLine(label: string, f: YtDlpFormat) {
                        let size = '';
                        if (f.filesize) size = ` (${(f.filesize / 1024 / 1024).toFixed(2)} MB)`;
                        else if (f.filesize_approx) size = ` (~${(f.filesize_approx / 1024 / 1024).toFixed(2)} MB)`;
                        return `• *${label}* [${f.format_note || f.format_id || ''}]${size}\n${f.url}\n`;
                    }
                    if (best) content += formatLine('Best', best);
                    if (standard && standard !== best && standard !== low) content += formatLine('Standard', standard);
                    if (low && low !== best) content += formatLine('Low', low);
                    if (bestAudio) {
                        let size = '';
                        if (bestAudio.filesize) size = ` (${(bestAudio.filesize / 1024 / 1024).toFixed(2)} MB)`;
                        else if (bestAudio.filesize_approx) size = ` (~${(bestAudio.filesize_approx / 1024 / 1024).toFixed(2)} MB)`;
                        content += `\nLink audio (audio only):\n`;
                        content += `• *Audio* [${bestAudio.format_note || bestAudio.format_id || ''}]${size}\n${bestAudio.url}\n`;
                        content += `\n*Catatan:* Untuk mendapatkan video kualitas tinggi dengan audio, download video dan audio lalu gabungkan dengan aplikasi seperti ffmpeg atau gunakan yt-dlp secara langsung untuk mengunduh file yang sudah digabungkan.`;
                    }
                    await client.messageClient.sendMessage(message.key.remoteJid, { text: content });
                } catch (error) {
                    logger.warn("Downloader error:", error);
                    await client.messageClient.sendMessage(message.key.remoteJid, { text: "Terjadi kesalahan saat mengambil link video." });
                }
            },
        }
    ]
} as CommandType;