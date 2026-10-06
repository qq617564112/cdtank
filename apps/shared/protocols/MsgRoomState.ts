export interface RoomStatePlayer {
  id: string;
  name: string;
}

export interface MsgRoomState {
  roomId: string;
  phase: string;
  players: RoomStatePlayer[];
  message: string;
}
