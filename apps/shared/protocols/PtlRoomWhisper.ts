import type {MsgRoomWhisper} from './MsgRoomWhisper';

export interface ReqRoomWhisper {
  text: string;
  targetName: string;
  roomId: string;
  round: number;
}

export interface ResRoomWhisper {
  message: MsgRoomWhisper;
}
