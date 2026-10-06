/** Rebuilt, session-owned request corresponding to the original untargeted Invite entry. */
export interface ReqRoomInvite {roomId: string; round: number;}
export interface ResRoomInvite {invitationId: string; recipientCount: number; expiresAt: number;}
