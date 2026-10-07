import type {MsgFamilyChat} from './MsgFamilyChat';

export interface ReqFamilyChat {
  text: string;
  roomId?: string;
  round?: number;
}

export interface ResFamilyChat {
  message: MsgFamilyChat;
  recipientCount: number;
}
