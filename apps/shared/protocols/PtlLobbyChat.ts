import type {MsgLobbyChat} from './MsgLobbyChat';

export interface ReqLobbyChat {
  text: string;
}

/** Confirms acceptance of this message, not delivery to every lobby connection. */
export interface ResLobbyChat {
  message: MsgLobbyChat;
}
