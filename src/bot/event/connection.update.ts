import { Boom } from '@hapi/boom';
import { ConnectionState, DisconnectReason } from 'baileys';
import qrcode from 'qrcode-terminal';
import type { ClientEvent } from '../type/client';
import type { WhatsappClient } from '../core/whatsaap';


async function handleConnectionOpen(client: WhatsappClient): Promise<void> {
    const session = client.getSession();
    if (!session) return;

    client.logger.info("✅ Connection established successfully.");

    try {

        const groupMetadata = await session.groupFetchAllParticipating();
        client.logger.info("Fetching and caching group metadata...");
        for (const jid in groupMetadata) {
            client.groupCache.set(jid, groupMetadata[jid]);
        }
        client.logger.info(`Cached metadata for ${Object.keys(groupMetadata).length} groups.`);

    } catch (error) {
        client.logger.error("❌ Failed during post-connection setup:", error);
    }
}

async function handleConnectionClose(client: WhatsappClient, lastDisconnect: ConnectionState['lastDisconnect']): Promise<void> {
    const error = lastDisconnect?.error;
    const statusCode = (error instanceof Boom) ? error.output.statusCode : 0;
    const reason = DisconnectReason[statusCode] || 'Unknown';

    client.logger.warn(`🔌 Connection closed. Reason: ${reason} (Code: ${statusCode})`);

    if (statusCode === DisconnectReason.loggedOut) {
        client.logger.error("Connection logged out. Please delete the auth folder and restart.");
        await client.destroySession(true);
        process.exit(1);
        return;
    }

    client.logger.info("Attempting to reconnect...");
    await client.createSession().catch(err => {
        client.logger.error("❌ Failed to re-create session:", err);
    });
}

const connectionUpdateEvent: ClientEvent = {
    event: "connection.update",
    listener: async (update, client) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            client.logger.info('📱 QR Code received, please scan with your phone.');
            qrcode.generate(qr, { small: true });
            return;
        }

        switch (connection) {
            case 'open':
                await handleConnectionOpen(client);
                break;
            case 'close':
                await handleConnectionClose(client, lastDisconnect);
                break;
        }
    },
};

export default connectionUpdateEvent;