import type {MsgFriendChat} from './MsgFriendChat';
export interface ReqFriendChat {text: string; roomId?: string; round?: number;}
export interface ResFriendChat {message: MsgFriendChat; recipientCount: number;}
