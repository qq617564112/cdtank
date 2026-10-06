import type {ModeMapConfig} from '../config';
import type {Battlefield} from '../battlefield';
import type {PlayerState} from '../battle/player-state';
import type {BulletState} from '../battle/projectiles';
import type {ObjectiveSnapshot, SceneObjectSnapshot, SceneCrushSnapshot, ScenePlantSnapshot, GroundTrapSnapshot, MatchResult} from '../../../shared/protocols';

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
  targetScore: number;
  result?: MatchResult;
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
