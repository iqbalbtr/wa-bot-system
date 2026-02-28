import { prefix } from "../../shared/constant/env"
import { generateSessionFooterContent } from "../lib/util";
import { Client, CommandType } from "../type/client";

export default {
    name: "help",
    description: "Menampilkan daftar perintah yang tersedia dan cara menggunakannya.",
    usage: `${prefix}help`,
    execute(message, client) {

        const limit = 5
        const page = 1;
        const totalItem = client.commandManager.getCommandCount();
        const totalPage = Math.ceil(totalItem / limit)

        let content = '';

        content += getDataHelpWithPagination(client, page, limit, totalPage);

        content += generateSessionFooterContent('help')

        client.sessionManager.startOrAdvanceSession(message, 'help', { page })
        client.messageClient.sendMessage((message.key.remoteJid || ""), {
            text: content
        });
    },
    commands: [
        {
            name: "/next",
            description: "Halaman berikutnya",
            execute: (message, client, payload, data) => {

                const limit = 5
                const totalItem = client.commandManager.getCommandCount();
                const totalPage = Math.ceil(totalItem / limit)
                let page = data.page;

                if (page >= totalPage) {
                    return client.messageClient.sendMessage((message.key.remoteJid || ""), {
                        text: "Halaman mencapai batas"
                    });
                }

                let content = getDataHelpWithPagination(client, ++page, limit, totalPage);
                content += generateSessionFooterContent('help')

                client.sessionManager.updateSessionData(message, { page })
                return client.messageClient.sendMessage((message.key.remoteJid || ""), {
                    text: content
                });
            }
        },
        {
            name: "/prev",
            description: "Kembali ke halaman sebelumnya",
            execute: (message, client, payload, data) => {

                const limit = 5
                const totalItem = client.commandManager.getCommandCount();
                const totalPage = Math.ceil(totalItem / limit)
                let page = data.page;

                if (page == 1) {
                    return client.messageClient.sendMessage((message.key.remoteJid || ""), {
                        text: "Halaman mencapai batas"
                    });
                }

                let content = getDataHelpWithPagination(client, --page, limit, totalPage);
                content += generateSessionFooterContent('help')

                client.sessionManager.updateSessionData(message, { page })
                return client.messageClient.sendMessage((message.key.remoteJid || ""), {
                    text: content
                });
            }
        }
    ]
} as CommandType

function getDataHelpWithPagination(client: Client, page: number, limit: number, totalPage: number) {
    const skip = (page - 1) * limit;
    const allCommand = [...client.commandManager.getAllCommands()].slice(skip, skip + limit);

    let content = `*📖 Daftar Perintah Bot*\n`;
    content += `*Halaman:* ${page} / ${totalPage}\n`;

    for (const command of allCommand) {
        content += `*${command.name}*\n`;
        content += `_${command.description}_\n`;
        if (command.usage) {
            content += `\`Contoh: ${command.usage}\`\n`;
        } else {
            content += `\`Contoh: ${prefix}${command.name}\`\n`;
        }
    }

    content += `\n* Gunakan perintah /next atau /prev untuk navigasi halaman.`;
    content += `\n* Jangan lupa mention bot jika di grup!`;

    return content;
}