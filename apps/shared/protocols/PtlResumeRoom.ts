import type {MsgRoomSnapshot} from './MsgRoomSnapshot';

/** Restore presentation of the same authenticated participant, never a new join. */
export interface ReqResumeRoom {roomId: string; playerId: string;}
export interface ResResumeRoom {snapshot: MsgRoomSnapshot; inputSequence: number;}
