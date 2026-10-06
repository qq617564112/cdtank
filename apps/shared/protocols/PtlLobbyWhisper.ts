import type {MsgLobbyWhisper} from './MsgLobbyWhisper';

export interface ReqLobbyWhisper {
  text: string;
  /** Exactly one target selector is required. */
  targetAccountId?: string;
  targetName?: string;
}

export interface ResLobbyWhisper {
  message: MsgLobbyWhisper;
}
