import { BaileysEventMap, proto, WAMessage } from "baileys";
import { WhatsappClient } from "../core/whatsaap";

export type Client = WhatsappClient

export type ClientEvent = {
  [K in keyof BaileysEventMap]: {
    event: K;
    listener: (payload: BaileysEventMap[K], session: Client) => void;
  };
}[keyof BaileysEventMap];

export type CommandType = {
  name: string;
  description: string;
  skipDefaultCommandReply?: boolean;
  usage?: string;
  execute: (
    message: WAMessage,
    client: Client,
    payload: PayloadMessage,
    data?: object | any
  ) => void,
  commands?: CommandType[]
}

export type SessionUserType = {
  current: string[]
  session: CommandType;
  data: object | any,
}

export type PayloadMessage = {
  from: string;
  groupId?: string;
  command: string;
  text: string;
  originalText: string;
  timestamp: number;
  message: proto.IMessage;
  isGroup: boolean;
  mentionedIds: string[];
  isMentioned: boolean
}

export type ClientContextType = {
  client: Client,
  message: WAMessage,
  payload: PayloadMessage
}
export type ClientMiddlewareType = (context: ClientContextType, next: () => void) => any
