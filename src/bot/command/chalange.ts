import fs from 'fs';
import path from 'path';
import { prefix } from "../../shared/constant/env";
import { CommandType } from "../type/client";
import { ChalangeType } from '../type/chalange';

export default {
    name: "event",
    usage: `${prefix}event`,
    description: "Cek detail tantangan biar gak nanya mulu",
    execute: async (msg, client) => {
        const remoteJid = msg.key?.remoteJid!;
        const currentChalangePath = path.resolve(process.cwd(), 'assets', 'chalange.json');

        if (!fs.existsSync(currentChalangePath)) {
            return client.messageClient.sendMessage(remoteJid, { text: '❌ Event-nya ga ada. Admin lagi turu.' });
        }

        let changelog: ChalangeType;
        try {
            changelog = JSON.parse(fs.readFileSync(currentChalangePath, 'utf-8'));
        } catch (e) {
            return client.messageClient.sendMessage(remoteJid, { text: '⚠️ JSON rusak. Adminnya ngetik pake kaki.' });
        }

        const deadline = new Date(changelog.due_date);
        const isExpired = new Date() > deadline;

        let content = `📌 *EVENT: ${changelog.title.toUpperCase()}*\n`;
        content += `📝 *Deskripsi:* \n_${changelog.description}_\n\n`;
        
        content += `🛠️ *Rules:* \n`;
        content += `└ 📉 Min Score: ${changelog.min_score}\n`;
        content += `└ 📈 Max Score: ${changelog.max_score}\n`;
        content += `└ 🔄 Max Attempts: ${changelog.max_attempts}x\n\n`;

        content += `🔗 *Instruksi Lengkap:* \n${changelog.instruction_url}\n\n`;
        
        content += `⏰ *Deadline:* ${changelog.due_date}\n`;
        content += isExpired 
            ? `*STATUS: EXPIRED (Udah telat, gausah maksa)*` 
            : `*STATUS: ACTIVE (Deadline gak nunggu lu bangun turu!)*`;

        await client.messageClient.sendMessage(remoteJid, { text: content });
    }
} as CommandType