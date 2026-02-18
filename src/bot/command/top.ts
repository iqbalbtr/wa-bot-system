import fs from 'fs';
import path from 'path';
import { prefix } from "../../shared/constant/env"; 
import { CommandType } from "../type/client";
import db from '../../database';
import { ChalangeType } from '../type/chalange';
import { asc, desc } from 'drizzle-orm';
import { chalangeStudent } from '../../database/schema';

export default {
    name: "top",
    usage: `${prefix}top`,
    description: "Cek siapa yang paling 'no-life'",
    execute: async (msg, client) => {
        const currentChalange = path.resolve(process.cwd(), 'assets', 'chalange.json');
        const remoteJid = msg.key?.remoteJid!;

        if (!fs.existsSync(currentChalange)) {
            return client.messageClient.sendMessage(remoteJid, { text: '❌ Config ilang. Skill issue admin?' });
        }

        let changelog: ChalangeType;
        try {
            changelog = JSON.parse(fs.readFileSync(currentChalange, 'utf-8'));
        } catch (e) {
            return client.messageClient.sendMessage(remoteJid, { text: '⚠️ JSON error. Lu ngetik pake kaki?' });
        }

        const topFive = await db.query.chalangeStudent.findMany({
            with: { student: true },
            orderBy: changelog?.order === 'asc' ? asc(chalangeStudent.score) : desc(chalangeStudent.score),
            limit: 5
        });

        if (topFive.length === 0) {
            return client.messageClient.sendMessage(remoteJid, { text: '📭 Kosong. Pada turu semua apa gimana?' });
        }

        let content = `*TOP 5: ${changelog.title}*\n`;

        topFive.forEach((item, index) => {
            const rank = index === 0 ? '👑' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🤡';
            content += `${rank} *${item.student.name || "User Ghaib"}* — ${item.score} pts\n`;
        });
        

        content += `_Skill issue yang nggak masuk list._`;

        await client.messageClient.sendMessage(remoteJid, { text: content });
    }
} as CommandType