/** Rebuilt private lobby delivery, separate from original channel IDs. */
export interface MsgLobbyWhisper {
  id: number;
  accountId: string;
  targetAccountId: string;
  senderName: string;
  targetName: string;
  text: string;
  message: string;
}
