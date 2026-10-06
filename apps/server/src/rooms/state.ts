import type {ModeMapConfig} from '../config';
import type {Battlefield} from '../battlefield';
import type {PlayerState} from '../battle/player-state';
import type {BulletState} from '../battle/projectiles';
import type {ObjectiveSnapshot, SceneObjectSnapshot, SceneCrushSnapshot, ScenePlantSnapshot, GroundTrapSnapshot, GroundItemSnapshot, MatchResult} from '../../../shared/protocols';
import type {RoundStats} from '../../../shared/protocols/MsgRoomSnapshot';

export interface DepartedParticipantRecord {
  id: string;
  name: string;
  team: number;
  score: number;
  kills: number;
  deaths: number;
  objectivesDestroyed: number;
  /** Deep clone frozen before removal, so a later round cannot mutate it. */
  roundStats?: RoundStats;
  /** Real PLAYING seconds up to the departure. */
  playedSeconds?: number;
}

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
  phase: 'WAITING' | 'LOADING' | 'PLAYING' | 'FINISHED';
  startedAt: number;
  endedAt: number;
  teamScores: number[];
  winnerTeam: number;
  round: number;
  ready: Set<string>;
  loaded: Set<string>;
  rematch: Set<string>;
  teamLives: number[];
  objectives: ObjectiveSnapshot[];
  sceneObjects: SceneObjectSnapshot[];
  sceneCrushes: SceneCrushSnapshot[];
  scenePlants?: ScenePlantSnapshot[];
  groundTraps: GroundTrapSnapshot[];
  groundItems: GroundItemSnapshot[];
  airstrikes: PendingAirstrike[];
  targetScore: number;
  result?: MatchResult;
  /** Frozen mid-round ordinary departures, merged into this round's final settlement. */
  departedParticipants?: Map<string, DepartedParticipantRecord>;
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
