import type {RoomSummary} from './PtlListRooms';

/** Rebuilt recruitment notification. Original 3d94 recipient scope is unknown. */
export interface MsgRoomInvitation {
  invitationId: string;
  room: RoomSummary;
  senderName: string;
  expiresAt: number;
}
