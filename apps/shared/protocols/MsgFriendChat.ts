/** Rebuilt account-friend channel with optional verified sender room origin. */
export interface MsgFriendChat {
  id: number;
  accountId: string;
  senderName: string;
  text: string;
  message: string;
  roomId?: string;
  round?: number;
}
