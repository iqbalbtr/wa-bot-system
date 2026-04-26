import fs from "fs";
import path from "path";
import { prefix } from "../../shared/constant/env";
import { CommandType } from "../type/client";
import db from "../../database";
import { chalangeStudent, groupSettings, student } from "../../database/schema";
import { generateSessionFooterContent, get_env } from "../lib/util";
import { getChalangeData } from "../../api/lib/util";
import { getTop } from "./top";
import { getCurrentCHalangeInfo } from "./tugas";
import google_api from "../core/google_api/auth";
import { and, eq } from "drizzle-orm";

const ADMIN_PHONE_NUMBERS = get_env("ADMIN_PHONE_NUMBER")
  .split(",")
  .map((v) => v.trim())
  .filter((v) => !isNaN(Number(v)));

const getChalangeHistory = async () => {
  const uniq_chalenge = await db
    .selectDistinct({
      challange_title: chalangeStudent.challange_title,
      challange_category: chalangeStudent.challange_category,
      challange_date: chalangeStudent.challange_date,
    })
    .from(chalangeStudent);

  return uniq_chalenge;
};
async function getSheets(
  challangeCategory: string,
  challengeTitle: string,
  challengeDate: string,
  createWhenMissing = false,
): Promise<string> {
  const target_folder_id = await google_api.drive.getTargetFolder([challangeCategory, challengeDate]);
  const existedSheets = await google_api.drive.search(target_folder_id, challengeTitle);

  if (existedSheets) {
    return existedSheets.id!;
  }

  if (!createWhenMissing) {
    throw Error("sheet tidak ditemukan. gunakan /edit untuk membuat sheet");
  }

  const sheetsId = await google_api.drive.createNewSheet(challengeTitle, target_folder_id);
  return sheetsId.id!;
}

const updateChalange = async (command: string, values: any) => {
  let chalange = getChalangeData();

  switch (command) {
    case "category":
      if (
        typeof values !== "string" ||
        values.trim() === "" ||
        !["web-development", "mobile-development", "cybersecurity"].includes(values.trim().toLowerCase())
      ) {
        throw new Error("Invalid category value");
      }
      chalange["category"] = values.trim().toLowerCase();
      break;
    case "title":
      if (typeof values !== "string" || values.trim() === "") {
        throw new Error("Invalid title value");
      }
      chalange["title"] = values.trim();
      break;
    case "description":
      if (typeof values !== "string" || values.trim() === "") {
        throw new Error("Invalid description value");
      }
      chalange["description"] = values.trim();
      break;
    case "start_date":
      if (isNaN(Date.parse(values))) {
        throw new Error("Invalid start_date value");
      }
      chalange["start_date"] = new Date(values).toISOString().split("T")[0];
      break;
    case "due_date":
      if (isNaN(Date.parse(values))) {
        throw new Error("Invalid due_date value");
      }
      chalange["due_date"] = new Date(values).toISOString().split("T")[0];
      break;
    case "instruction_url":
      if (typeof values !== "string" || values.trim() === "" || !/^https?:\/\/\S+$/.test(values.trim())) {
        throw new Error("Invalid instruction_url value");
      }
      chalange["instruction_url"] = values.trim();
      break;
    case "challenge_instruction":
      if (typeof values !== "string" || values.trim() === "" || !/^https?:\/\/\S+$/.test(values.trim())) {
        throw new Error("Invalid challenge_instruction value");
      }
      chalange["challenge_instruction"] = values.trim();
      break;
    case "submission_url":
      if (typeof values !== "string" || values.trim() === "" || !/^https?:\/\/\S+$/.test(values.trim())) {
        throw new Error("Invalid submission_url value");
      }
      chalange["submission_url"] = values.trim();
      break;
    case "message":
      if (typeof values !== "string" || values.trim() === "") {
        throw new Error("Invalid message value");
      }
      chalange["message"] = values.trim();
      break;
    default:
      throw new Error("Invalid command");
  }

  const configPath = path.resolve(process.cwd(), "assets", "chalange.json");
  fs.writeFileSync(configPath, JSON.stringify(chalange, null, 2));

  return chalange;
};

export default {
  name: "ch-admin",
  usage: `${prefix}ch-admin`,
  description: "Kelola tantangan (Admin Only)",
  execute: async (msg, client, payload) => {
    const remoteJid = msg.key?.remoteJid!;
    const student_phone = payload.from.startsWith("62") ? payload.from : remoteJid.split("@")[0];

    if (!ADMIN_PHONE_NUMBERS.find((admin) => student_phone.startsWith(admin))) {
      return client.messageClient.sendMessage(remoteJid, {
        text: `❌ *Akses Ditolak:* Anda tidak memiliki izin untuk menggunakan perintah ini.`,
      });
    }

    client.sessionManager.startOrAdvanceSession(msg, "ch-admin");
    const reply = generateSessionFooterContent("ch-admin");
    client.messageClient.sendMessage(remoteJid, { text: reply });
  },
  commands: [
    {
      name: "/history",
      description: "Menampilkan riwayat tantangan sebelumnya",
      usage: `${prefix}ch-admin history`,
      execute: async (msg, client) => {
        const remoteJid = msg.key?.remoteJid!;

        const normalizedChalange = await getChalangeHistory();

        client.sessionManager.updateSessionData(msg, { histories: normalizedChalange });

        let content = `📜 *RIWAYAT TANTANGAN SEBELUMNYA:*\n\n`;

        const result = Array.isArray(normalizedChalange) && normalizedChalange.length > 0 ? normalizedChalange : [];

        result.forEach((item, index) => {
          content += `📌 *${index + 1}. ${item.challange_title}* (${item.challange_category} - ${item.challange_date})\n`;
        });

        content += `\n*Gunakan perintah berikut untuk memilih tantangan:*\n`;
        content += `- /command urutan\n`;
        content += generateSessionFooterContent("ch-admin");

        return client.messageClient.sendMessage(remoteJid, { text: content });
      },
    },
    {
      name: "/edit",
      description: "Edit data tantangan `/edit urutan`",
      usage: `/edit urutan`,
      execute: async (msg, client, payload, data) => {
        const remoteJid = msg.key?.remoteJid!;

        const params = payload.text;

        let targetSequence = Number(params.trim());

        if (isNaN(targetSequence) || targetSequence < 1) {
          return client.messageClient.sendMessage(remoteJid, {
            text: `❌ *Input Tidak Valid:* Harap masukkan nomor urutan tantangan yang valid.`,
          });
        }
        // this method return data with this format { category, date, title }
        const sequenceTarget = await getChalangeHistory();

        if (targetSequence > sequenceTarget.length) {
          return client.messageClient.sendMessage(remoteJid, {
            text: `❌ *Input Tidak Valid:* Harap masukkan nomor urutan tantangan yang valid.`,
          });
        }
        const { challange_category, challange_date, challange_title } = sequenceTarget[targetSequence - 1];

        const sheetsId = await getSheets(challange_category, challange_title, challange_date || "penilaian", true);

        const challange_record = await db
          .select()
          .from(chalangeStudent)
          .innerJoin(student, eq(student.id, chalangeStudent.id))
          .where(
            and(
              eq(chalangeStudent.challange_category, challange_category),
              eq(chalangeStudent.challange_title, challange_title),
            ),
          );

        const table: any[][] = [["ID", "NIM", "Score", "dilarang mengganti format, dan data selain score! "]];

        challange_record.forEach((e) => {
          table.push([e.chalange_students.id, e.students.nim, e.chalange_students.score]);
        });

        await google_api.sheet.updateSheets(sheetsId, table);
        const link = `https://docs.google.com/spreadsheets/d/${sheetsId}/edit`;

        return client.messageClient.sendMessage(remoteJid, {
          text: `🔗 *LINK EDIT TANTANGAN:*\n\n${link}\n\n*Catatan: Link ini hanya contoh. Implementasi penyimpanan dan pengambilan data tantangan dari Google Sheets atau sumber lain diperlukan untuk fungsionalitas penuh.*`,
        });
      },
    },
    {
      name: "/save",
      description: "Simpan data tantangan dari file CSV `/save urutan`",
      usage: `/save urutan`,
      execute: async (msg, client, payload, data) => {
        const remoteJid = msg.key?.remoteJid!;

        const params = payload.text;

        let targetSequence = Number(params.trim());

        if (isNaN(targetSequence) || targetSequence < 1) {
          return client.messageClient.sendMessage(remoteJid, {
            text: `❌ *Input Tidak Valid:* Harap masukkan nomor urutan tantangan yang valid.`,
          });
        }

        const sequenceTarget = await getChalangeHistory();

        if (targetSequence > sequenceTarget.length) {
          return client.messageClient.sendMessage(remoteJid, {
            text: `❌ *Input Tidak Valid:* Harap masukkan nomor urutan tantangan yang valid.`,
          });
        }
        const { challange_category, challange_date, challange_title } = sequenceTarget[targetSequence - 1];

        const sheetsId = await getSheets(challange_category, challange_title, challange_date || "penilaian");

        const sheetsTable = await google_api.sheet.reaedSheets(sheetsId, "A:C");

        if (!sheetsTable.values) {
          return client.messageClient.sendMessage(remoteJid, {
            text: `❌ *Sheet kosong:* gunakan perintah /edit untuk update SpreadSheets`,
          });
        }

        const challenge_record = await db
          .select()
          .from(chalangeStudent)
          .where(
            and(
              eq(chalangeStudent.challange_category, challange_category),
              eq(chalangeStudent.challange_title, challange_title),
            ),
          );

        const challengedata = new Map(challenge_record.map((v) => [v.id, v.score]));

        for (const row of sheetsTable.values) {
          const [id, _nim, score] = row;

          if (challengedata.get(id) != score) {
            await db.update(chalangeStudent).set({ score }).where(eq(chalangeStudent.id, id));
          }
        }

        return client.messageClient.sendMessage(remoteJid, {
          text: `✅ *SUKSES:* Data tantangan untuk ${challange_title} berhasil disimpan ke database. ${challenge_record.length !== sheetsTable.values.length - 1 ? "terdapat perbedaan jumlah data. update dengan /edit untuk mendapatkan data terbaru":""}`,
        });
      },
    },
    {
      name: "/announce",
      description: "Umumkan tantangan baru ke semua pengguna",
      usage: `/announce`,
      execute: async (msg, client) => {
        const remoteJid = msg.key?.remoteJid!;

        const content = await getCurrentCHalangeInfo();

        const isExist = await db.select().from(groupSettings);

        for (const groupId of isExist) {
          await client.messageClient.sendMessage(groupId.group_id, { text: content });
        }

        return client.messageClient.sendMessage(remoteJid, {
          text: `✅ *SUKSES:* Tantangan baru berhasil diumumkan ke semua grup yang terdaftar.\n\n*Catatan: Pastikan grup yang dituju sudah terdaftar di database untuk menerima pengumuman.*`,
        });
      },
    },
    {
      name: "/announce-top",
      description: "Umumkan peringkat terbaik ke semua pengguna",
      usage: `/announce-top`,
      execute: async (msg, client) => {
        const remoteJid = msg.key?.remoteJid!;
        const chall = getChalangeData();
        const top = await getTop(remoteJid, chall.category, chall.start_date);
        const isExist = await db.select().from(groupSettings);
        for (const groupId of isExist) {
          await client.messageClient.sendMessage(groupId.group_id, {
            text: top,
          });
        }

        return client.messageClient.sendMessage(remoteJid, {
          text: `✅ *SUKSES:* Peringkat terbaik berhasil diumumkan ke semua grup yang terdaftar.\n\n*Catatan: Pastikan grup yang dituju sudah terdaftar di database untuk menerima pengumuman.*`,
        });
      },
    },
    {
      name: "/up-ch",
      description: "Perbarui data tantangan",
      usage: "/up-ch field:value",
      execute: async (msg, client, payload) => {
        const remoteJid = msg.key?.remoteJid!;

        const chlange = getChalangeData();

        const validFields = [
          "category",
          "title",
          "description",
          "start_date",
          "due_date",
          "instruction_url",
          "challenge_instruction",
          "submission_url",
          "message",
        ];

        const [field, value] = payload.text.split(":");
        if (!field || !value) {
          return client.messageClient.sendMessage(remoteJid, {
            text: `❌ *Input Tidak Valid:* Harap masukkan format yang benar: /up-ch field:value`,
          });
        }

        if (!validFields.includes(field)) {
          return client.messageClient.sendMessage(remoteJid, {
            text: `❌ *Input Tidak Valid:* Field '${field}' tidak valid. Gunakan field yang tersedia. ${validFields.join(", ")}`,
          });
        }

        await updateChalange(field.trim(), value.trim());

        return client.messageClient.sendMessage(remoteJid, {
          text: `✅ *SUKSES:* Data tantangan berhasil diperbarui.\n\n*Catatan: Implementasi pembaruan data tantangan secara langsung diperlukan untuk fungsionalitas penuh.*`,
        });
      },
    },
  ],
} as CommandType;
