import type {MsgPlayerInput, MsgPlayerAction, MsgRoomSnapshot, MsgRoomEvent, ResJoin} from '../../../shared/protocols';
import type {ReqCpu} from '../../../shared/protocols/PtlCpu';
import type {ReqEditRoom} from '../../../shared/protocols/PtlEditRoom';
import type {ReqReady} from '../../../shared/protocols/PtlReady';
import type {ResInventory} from '../../../shared/protocols/PtlInventory';

export interface TrainingOptions {
  mapId: number;
  roomName: string;
  name: string;
  tankId: number;
  minPlayers?: number;
  maxPlayers?: number;
  timeLimitSeconds?: number;
}

export type TrainingCommand =
  | {type: 'create'; options: TrainingOptions}
  | {type: 'ready'; request: ReqReady}
  | {type: 'edit'; request: ReqEditRoom}
  | {type: 'cpu'; request: ReqCpu}
  | {type: 'kick'; round: number; playerId: string}
  | {type: 'autopilot'; round: number; enabled: boolean}
  | {type: 'rematch'; round: number}
  | {type: 'input'; input: MsgPlayerInput}
  | {type: 'action'; action: MsgPlayerAction}
  | {type: 'inventory'};

export interface TrainingRequest {id: number; command: TrainingCommand;}
export interface TrainingReply {join?: ResJoin; inventory?: ResInventory;}
export type TrainingPublication =
  | {type: 'state'; snapshot: MsgRoomSnapshot; events: MsgRoomEvent[]}
  | {type: 'reply'; id: number; result?: TrainingReply; error?: string}
  | {type: 'failure'; error: string};
