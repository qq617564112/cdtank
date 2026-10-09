import type {MsgRoomSnapshot, RoomSummary} from '../../../shared/protocols';
import type {World, WorldEvent} from '../world';
import type {RoomCommand} from '../rooms/world-interface';

export type WorldOptions = NonNullable<ConstructorParameters<typeof World>[1]>;

export interface RoomServices {
  allocatePlayerId(): string;
  consumeItem: NonNullable<WorldOptions['consumeItem']>;
  acquireOwnedItem: NonNullable<WorldOptions['acquireOwnedItem']>;
  discardOwnedItem: NonNullable<WorldOptions['discardOwnedItem']>;
  currentTitle: NonNullable<WorldOptions['currentTitle']>;
  commitMatch: NonNullable<WorldOptions['onMatchCommitted']>;
  inventoryRecord: NonNullable<WorldOptions['onInventoryRecord']>;
}

export interface RoomStatePublication {
  snapshot?: MsgRoomSnapshot;
  summary?: RoomSummary;
}

export type RoomRequest = {
  [K in RoomCommand]: {type: 'command'; id: number; method: K; args: Parameters<World[K]>;
    identity?: {connectionId: string; accountId: string}};
}[RoomCommand];

export interface RoomInit {
  type: 'init';
  roomId: string;
  tickRate: number;
  options: Pick<WorldOptions, 'minPlayers' | 'timeLimitSeconds'>;
}

export type RoomMessage =
  | {type: 'ready'}
  | {type: 'tick'; state: RoomStatePublication; events: WorldEvent[]}
  | {type: 'reply'; id: number; result?: unknown; error?: string; state?: RoomStatePublication};

export type RoomServiceRequest = {
  [K in keyof RoomServices]: {method: K; args: Parameters<RoomServices[K]>};
}[keyof RoomServices];

export interface RoomServiceReply {result?: unknown; error?: string;}
