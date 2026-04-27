import fs from 'fs';
import path from 'path';
import { eventGroupId, prefix } from "../../shared/constant/env";
import { CommandType } from "../type/client";
import { ChalangeType } from '../type/chalange';
import db from '../../database';
import { chalangeStudent, groupSettings, student } from '../../database/schema';
import { generateSessionFooterContent } from '../lib/util';
import { getChalangeData } from '../../api/lib/util';
import { getTop } from './top';
import { getCurrentCHalangeInfo } from './tugas';

const ADMIN_PHONE_NUMBERS = [
    '6281226948547',
    '6281809446644',
    '6287833461846',
    '6288239158584'
];

const getChalangeHistory = async (sequenceTarget?: number) => {

    const result = await db
        .select({
            category: chalangeStudent.challange_category,
            date: chalangeStudent.challange_date,
            title: chalangeStudent.challange_title,
        })
        .from(chalangeStudent)
        .groupBy(
            chalangeStudent.challange_category,
            chalangeStudent.challange_date,
            chalangeStudent.challange_title,
        );

    if (sequenceTarget) {
        return result[sequenceTarget - 1] || null;
    }

    return result;
}

const updateChalange = async (command: string, values: any) => {

    let chalange = getChalangeData();

    switch (command) {
        case "category":
            if (typeof values !== 'string' || values.trim() === '' || !['web-development', 'mobile-development', 'cybersecurity'].includes(values.trim().toLowerCase())) {
                throw new Error("Invalid category value");
            }
            chalange['category'] = values.trim().toLowerCase();
            break;
        case "title":
            if (typeof values !== 'string' || values.trim() === '') {
                throw new Error("Invalid title value");
            }
            chalange['title'] = values.trim();
            break;
        case "description":
            if (typeof values !== 'string' || values.trim() === '') {
                throw new Error("Invalid description value");
            }
            chalange['description'] = values.trim();
            break;
        case "start_date":
            if (isNaN(Date.parse(values))) {
                throw new Error("Invalid start_date value");
            }
            chalange['start_date'] = new Date(values).toISOString().split('T')[0];
            break;
        case "due_date":
            if (isNaN(Date.parse(values))) {
                throw new Error("Invalid due_date value");
            }
            chalange['due_date'] = new Date(values).toISOString().split('T')[0];
            break;
        case "instruction_url":
            if (typeof values !== 'string' || values.trim() === '' || !/^https?:\/\/\S+$/.test(values.trim())) {
                throw new Error("Invalid instruction_url value");
            }
            chalange['instruction_url'] = values.trim();
            break;
        case "challenge_instruction":
            if (typeof values !== 'string' || values.trim() === '' || !/^https?:\/\/\S+$/.test(values.trim())) {
                throw new Error("Invalid challenge_instruction value");
            }
            chalange['challenge_instruction'] = values.trim();
            break;
        case "submission_url":
            if (typeof values !== 'string' || values.trim() === '' || !/^https?:\/\/\S+$/.test(values.trim())) {
                throw new Error("Invalid submission_url value");
            }
            chalange['submission_url'] = values.trim();
            break;
        case "message":
            if (typeof values !== 'string' || values.trim() === '') {
                throw new Error("Invalid message value");
            }
            chalange['message'] = values.trim();
            break;
        default:
            throw new Error("Invalid command");
    }

    const configPath = path.resolve(process.cwd(), 'assets', 'chalange.json');
    fs.writeFileSync(configPath, JSON.stringify(chalange, null, 2));

    return chalange;
}

export default {
    name: "ch-admin",
    usage: `${prefix}ch-admin`,
    description: "Kelola tantangan (Admin Only)",
    execute: async (msg, client, payload) => {
        const remoteJid = msg.key?.remoteJid!;
        if (!ADMIN_PHONE_NUMBERS.find(admin => payload.from.startsWith(admin))) {
            return client.messageClient.sendMessage(remoteJid, {
                text: `❌ *Akses Ditolak:* Anda tidak memiliki izin untuk menggunakan perintah ini.`
            })
        }

        client.sessionManager.startOrAdvanceSession(msg, 'ch-admin');
        const reply = generateSessionFooterContent("ch-admin");
        client.messageClient.sendMessage(remoteJid, { text: reply });
    },
    commands: [
        {
            name: '/history',
            description: 'Menampilkan riwayat tantangan sebelumnya',
            usage: `${prefix}ch-admin history`,
            execute: async (msg, client) => {

                const remoteJid = msg.key?.remoteJid!;

                const normalizedChalange = await getChalangeHistory();
                console.log('normalizedChalange', normalizedChalange);
                client.sessionManager.updateSessionData(msg, { histories: normalizedChalange });

                let content = `📜 *RIWAYAT TANTANGAN SEBELUMNYA:*\n\n`;

                const result = Array.isArray(normalizedChalange) && normalizedChalange.length > 0 ? normalizedChalange : [];

                result.forEach((item, index) => {
                    content += `📌 *${index + 1}. ${item.title}* (${item.category} - ${item.date})\n`;
                });

                content += `\n*Gunakan perintah berikut untuk memilih tantangan:*\n`;
                content += `- /command urutan\n`;
                content += generateSessionFooterContent("ch-admin");

                return client.messageClient.sendMessage(remoteJid, { text: content });
            }
        },
        {
            name: '/edit',
            description: 'Edit data tantangan `/edit urutan`',
            usage: `/edit urutan`,
            execute: async (msg, client, payload, data) => {

                const remoteJid = msg.key?.remoteJid!;

                const params = payload.text

                const targetSequence = Number(params.trim());

                if (isNaN(targetSequence) || targetSequence < 1) {
                    return client.messageClient.sendMessage(remoteJid, { text: `❌ *Input Tidak Valid:* Harap masukkan nomor urutan tantangan yang valid.` });
                }

                // this method return data with this format { category, date, title }
                const sequenceTarget = await getChalangeHistory(targetSequence);

                // validate if file exist in dir /admin/[category]/[date]/[filename].xlsx or /admin/[category]/[date].csv

                // validate must be array

                // generate excel link
                // save dir like this /admin/[category]/[date]/[filename].xlsx or /admin/[category]/[date].csv

                const exampleLink = `https://docs.google.com/spreadsheets/d/1abc123/edit?usp=sharing`;

                return client.messageClient.sendMessage(remoteJid, {
                    text: `🔗 *LINK EDIT TANTANGAN:*\n\n${exampleLink}\n\n*Catatan: Link ini hanya contoh. Implementasi penyimpanan dan pengambilan data tantangan dari Google Sheets atau sumber lain diperlukan untuk fungsionalitas penuh.*`
                });
            }
        },
        {
            name: '/save',
            description: 'Simpan data tantangan dari file CSV `/save urutan`',
            usage: `/save urutan`,
            execute: async (msg, client, payload, data) => {
                const remoteJid = msg.key?.remoteJid!;

                const params = payload.text

                const targetSequence = Number(params.trim());

                if (isNaN(targetSequence) || targetSequence < 1) {
                    return client.messageClient.sendMessage(remoteJid, { text: `❌ *Input Tidak Valid:* Harap masukkan nomor urutan tantangan yang valid.` });
                }

                // this method return data with this format { category, date, title }
                const sequenceTarget = await getChalangeHistory(targetSequence);

                // read spreasheedt and sync to chalange db

                const resultRead = [
                    {
                        nim: '12345678',
                        score: 85,
                    },
                    {
                        nim: '87654321',
                        score: 90,
                    }
                ]

                // loop student and update score in chalange_student table based on nim and challange date and category

                // validate if file exist in dir /admin/[category]/[date]/[filename].xlsx or /admin/[category]/[date].csv

                // sync data from file to database

                return client.messageClient.sendMessage(remoteJid, {
                    text: `✅ *SUKSES:* Data tantangan untuk urutan ${targetSequence} berhasil disimpan ke database.\n\n*Catatan: Implementasi penyimpanan data tantangan dari file CSV atau Excel diperlukan untuk fungsionalitas penuh.*`
                });
            }
        },
        {
            name: '/announce',
            description: 'Umumkan tantangan baru ke semua pengguna',
            usage: `/announce`,
            execute: async (msg, client) => {
                const remoteJid = msg.key?.remoteJid!;

                const content = await getCurrentCHalangeInfo();

                const isExist = await db.select().from(groupSettings);

                for (const groupId of isExist) {
                    await client.messageClient.sendMessage(groupId.group_id, { text: content });
                }

                return client.messageClient.sendMessage(remoteJid, {
                    text: `✅ *SUKSES:* Tantangan baru berhasil diumumkan ke semua grup yang terdaftar.\n\n*Catatan: Pastikan grup yang dituju sudah terdaftar di database untuk menerima pengumuman.*`
                });
            }
        },
        {
            name: '/announce-top',
            description: 'Umumkan peringkat terbaik ke semua pengguna',
            usage: `/announce-top`,
            execute: async (msg, client) => {
                const remoteJid = msg.key?.remoteJid!;
                const chall = getChalangeData();
                const top = await getTop(remoteJid, chall.category, chall.start_date);
                const isExist = await db.select().from(groupSettings);
                for (const groupId of isExist) {
                    await client.messageClient.sendMessage(groupId.group_id, {
                        text: top
                    });
                }

                return client.messageClient.sendMessage(remoteJid, {
                    text: `✅ *SUKSES:* Peringkat terbaik berhasil diumumkan ke semua grup yang terdaftar.\n\n*Catatan: Pastikan grup yang dituju sudah terdaftar di database untuk menerima pengumuman.*`
                });
            }
        },
        {
            name: "/up-ch",
            description: "Perbarui data tantangan",
            usage: "/up-ch field:value",
            execute: async (msg, client, payload) => {
                const remoteJid = msg.key?.remoteJid!;

                const chlange = getChalangeData();

                const validFields = ["category", "title", "description", "start_date", "due_date", "instruction_url", "challenge_instruction", "submission_url", "message"];

                const [field, value] = payload.text.split(':');
                if (!field || !value) {
                    return client.messageClient.sendMessage(remoteJid, { text: `❌ *Input Tidak Valid:* Harap masukkan format yang benar: /up-ch field:value` });
                }

                if (!validFields.includes(field)) {
                    return client.messageClient.sendMessage(remoteJid, { text: `❌ *Input Tidak Valid:* Field '${field}' tidak valid. Gunakan field yang tersedia. ${validFields.join(', ')}` });
                }

                await updateChalange(field.trim(), value.trim());

                return client.messageClient.sendMessage(remoteJid, {
                    text: `✅ *SUKSES:* Data tantangan berhasil diperbarui.\n\n*Catatan: Implementasi pembaruan data tantangan secara langsung diperlukan untuk fungsionalitas penuh.*`
                });
            }
        }
    ]
} as CommandType;
