import type {ReqCpu, ResCpu} from '../protocols/PtlCpu';

/** POST /game/api/rooms/:roomId/cpus; room state continues through RoomSnapshot. */
export interface ReqAddRoomCpu extends Pick<ReqCpu, 'round' | 'tankId' | 'team'> {
  requesterPlayerId: string;
}
export type ResAddRoomCpu = ResCpu;

export interface RoomCpuHttpError {
  error: {code: string; message: string};
}
