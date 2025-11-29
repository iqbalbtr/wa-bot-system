import { eq } from "drizzle-orm";
import db from "../../database";
import { groupSettings } from "../../database/schema";
import { ClientEvent } from "../type/client";
import { groupEnumSetting } from "../command/group";

export default {
    event: "group-participants.update",
    listener: async (event, client) => {

        const { id, participants, action, author } = event;

        try {
            const session = client.getSession();

            if (!session) {
                client.logger.warn("No active session found for updating group metadata.");
                return;
            }

            if(action) {
                const group = await session.groupMetadata(id)
                client.groupCache.set(id, group);
            }

            if (action == "add") {

                const isGroup = (await db.select().from(groupSettings).where(eq(groupSettings.group_id, id)).limit(1))[0];
                const isGreetingActive = isGroup.settings.find(s => s.key === groupEnumSetting.GREETING_NEW_MEMBER && s.value)

                if (isGroup && isGreetingActive) {
                    const welcomeText = `Halo dan selamat datang di grup, @${participants[0].phoneNumber!.split('@')[0]}! 🎉`;

                    await client.messageClient.sendMessage(id, {
                        text: welcomeText,
                        mentions: [participants[0].phoneNumber!]
                    });
                }
            }

            const metadata = await session.groupMetadata(event.id);

            client.groupCache.set(event.id, metadata);
        } catch (error) {
            client.logger.warn(`Failed to update cache for group ${event.id}:`, error);
        }
    }
} as ClientEvent