/** Rebuilt family channel message, separate from friends, teams, rooms and GM. */
export interface MsgFamilyChat {
  id: number;
  accountId: string;
  senderName: string;
  familyId: string;
  familyName: string;
  text: string;
  message: string;
  roomId?: string;
  round?: number;
}
