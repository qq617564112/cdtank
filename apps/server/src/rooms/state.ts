import type {ModeMapConfig} from '../config';
import type {Battlefield} from '../battlefield';
import type {PlayerState} from '../battle/player-state';
import type {BulletState} from '../battle/projectiles';
import type {ObjectiveSnapshot, SceneObjectSnapshot, SceneCrushSnapshot, ScenePlantSnapshot, GroundTrapSnapshot, MatchResult} from '../../../shared/protocols';
import type {MatchResultInput} from '../settlement/match-result';

/** Server-only in-flight item13 cast; never enters MsgRoomSnapshot. */
export interface PendingAirstrike {
  ownerId: string;
  team: number;
  x: number;
  y: number;
  z: number;
  resolvesAt: number;
  sourceSkillId: number;
}

export interface RoomState {
  roomId: string;
  roomName: string;
  mode: number;
  map: ModeMapConfig;
  minPlayers?: number;
  maxPlayers?: number;
  friendlyFire?: boolean;
  battlefield: Battlefield;
  players: Map<string, PlayerState>;
  bullets: BulletState[];
  phase: 'WAITING' | 'PLAYING' | 'FINISHED';
  startedAt: number;
  endedAt: number;
  teamScores: number[];
  winnerTeam: number;
  round: number;
  ready: Set<string>;
  rematch: Set<string>;
  teamLives: number[];
  objectives: ObjectiveSnapshot[];
  sceneObjects: SceneObjectSnapshot[];
  sceneCrushes: SceneCrushSnapshot[];
  scenePlants?: ScenePlantSnapshot[];
  groundTraps: GroundTrapSnapshot[];
  airstrikes: PendingAirstrike[];
  targetScore: number;
  result?: MatchResult;
  /** Frozen mid-round ordinary departures, merged into this round's final settlement. */
  departedParticipants?: Map<string, MatchResultInput['players'][number]>;
  creatorClientId?: string;
  creationKey?: string;
  passwordSalt?: Buffer;
  passwordHash?: Buffer;
  tick: number;
}

export interface JoinResult {
  playerId: string;
  roomId: string;
  mode: number;
  mapId: number;
}
