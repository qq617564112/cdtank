/** Rebuilt online-account whisper carrying the sender's room/round origin. */
export interface MsgRoomWhisper {
  id: number;
  roomId: string;
  round: number;
  accountId: string;
  targetAccountId: string;
  senderName: string;
  targetName: string;
  text: string;
  message: string;
}
