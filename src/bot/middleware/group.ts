import { eq } from "drizzle-orm";
import db from "../../database";
import { groupSettings } from "../../database/schema";
import { ClientContextType } from "../type/client";
import { groupEnumSetting } from "../command/group";

export function groupMiddleware(context: ClientContextType, next: () => void) {

    const { client, message, payload } = context;

    return new Promise(async (resolve) => {

        const userId = message.key?.remoteJid

        if (!userId)
            return
        
        if (!userId.endsWith("@g.us")) {

            const isSession = client.sessionManager.getUserSession(payload.from);

            client.sessionManager.endSessionForUser(message)
            client.messageClient.sendMessage(userId, {
                text: isSession ? "Anda akan dikeluarkan dari sesi grup" : "Perintah ini hanya bisa digunakan di grup."
            });

            return ;
        }

        const isExist = (await db.select().from(groupSettings).where(eq(groupSettings.group_id, userId)).limit(1))[0];
        const currentGroup = client.groupCache.get(userId);

        if (isExist) {
            const allowCommandInGroup = isExist.settings.find((setting) => setting.key === groupEnumSetting.ALLOW_COMMAND);
            const isAdmin = currentGroup?.participants.find((p) => p.id === message.key?.participant && p.admin)
            if (
                allowCommandInGroup &&
                !allowCommandInGroup.value &&
                !isAdmin
            ) {

                if (payload.isGroup && payload.isMentioned) {
                    client.messageClient.sendMessage(userId, {
                        text: "Hanya admin yang bisa menggunakan command, silakan ubah setingan group.",
                        mentions: [message.key?.participant!]
                    });
                }
                return;
            }
        }

        resolve(next())
    })
}