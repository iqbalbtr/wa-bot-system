import client from "../../bot";
import { ClientContextType, ClientMiddlewareType, CommandType } from "../type/client";

export function extractMessageFromCommand(body: string) {
    return body.split(" ")[1]
}

export function extractContactId(message: string): string {
    return message.split("@")[0].replace(/[^0-9]/g, "");
}

export function extractLid(message: string): string {
    const test = message.includes(":") ? message.split(":")[0].trim() : "";
    if (test)
        return test
    return message.split("@")[0];
}

export async function middlewareApplier(
    context: ClientContextType,
    middlewares: { command: string[], middleware: ClientMiddlewareType }[],
    finalFn: () => void
) {
    const { payload, client } = context;
    const userSession = client.sessionManager.getUserSession(payload.from);

    let index = -1;

    async function next(i: number) {
        if (i <= index) throw new Error("next() called multiple times");
        index = i;

        if (i === middlewares.length) {
            return finalFn();
        }

        const middleware = middlewares[i];
        const currentCommand = userSession?.current[0] ?? payload.command;
        const isCommand = middleware.command.includes("*") || middleware.command.includes(currentCommand);

        if (middleware && isCommand) {
            await middleware.middleware(context, () => next(i + 1));
        } else {
            await next(i + 1);
        }
    }

    await next(0);
}

export function extractCommandFromPrefix(body: string) {

    const prefix = client.getPrefix();

    if (body.trim().startsWith("/")) {
        return body.trim().split(" ")[0];
    }

    if (body.trim().startsWith(prefix)) {
        return body.trim().split(prefix)[1].split(" ")[0].toLowerCase();
    }
    return null;
}

export function extractMessageFromGroupMessage(text: string) {

    let res = ""

    text.split(" ").forEach((word, index) => {
        if (!word.startsWith("@")) {
            res += word + " ";
        }
    })

    return res.trim();
}


export function generateSessionFooterContent(...names: string[]) {
    let session: CommandType | undefined = undefined;

    for (const name of names) {
        if (!session) {
            session = client.commandManager.getCommand(name);
        } else {
            session = session.commands?.find((fo) => fo.name == name);
        }
    }

    if (!session?.commands) {
        return '';
    }

    let content = 'Gunakan command berikut:\n';

    session.commands.forEach((cmd) => {
        content += `\n  • *\`${cmd.name}\`* - ${cmd.description}`;
    });

    if (names.length > 1) {
        content += `\n\n  • *\`/back\`* - untuk kembali`;
    }

    content += `\n  • *\`/exit\`* - untuk keluar`;

    return content;
}

export function get_env(key: string){
    const value = process.env[key]

    if (!value){
        throw Error(`${key} is not defined in env. please make sure that ${key} is defined in .env`)
    }

    return value
}