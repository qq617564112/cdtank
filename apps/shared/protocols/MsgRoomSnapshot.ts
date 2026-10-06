import type {OwnedTankTextures} from '../combat/role-owned-textures';
import type {CpuLoadoutItem} from './PtlCpu';

/** Rebuilt skill10/11 lifetime; the source4173 replacement is created at the activation pose. */
export interface RoleDisguiseSnapshot {
  skillId: 10 | 11;
  style: 1 | 2;
  startedAt: number;
  expiresAt: number;
  x: number;
  y: number;
  z: number;
}

export interface PlayerSnapshot {
  id: string;
  name: string;
  tankId: number;
  /** Selected owned pet definition; the original HUD indexes PetTable, not TankTable. */
  petId?: number;
  /** Rebuilt selected-pet source; passive selection uses the recovered predicate. */
  roleSkillSources?: {
    currentSkillIds: number[];
    equipmentSkills: {baseId: number; rank: number}[];
    selectedSkillIds: number[];
  };
  /** Rebuilt snapshot carries the selected owned tank’s recovered U/M/XY fields. */
  tankTextures?: OwnedTankTextures;
  /** Confirmed five-part passive queue; original playback waits for a live actor. */
  queuedPartSkillIds?: number[];
  team: number;
  x: number;
  y: number;
  z: number;
  /** Movement look angle; retained as the rebuilt aiming reference. */
  yaw: number;
  /** Original independent forward angle, used for the rendered tank body. */
  bodyYaw?: number;
  aim: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  score: number;
  kills: number;
  deaths: number;
  respawnAt: number;
  isVIP: boolean;
  objectivesDestroyed?: number;
  isCpu?: boolean;
  /** Rebuilt CPU-only temporary stock and configured ordinary hotkey slots. */
  cpuLoadout?: CpuLoadoutItem[];
  /** Rebuilt voluntary AI control; this participant still votes and owns its account. */
  isAutopilot?: boolean;
  /** 0/1 use default ammo; slots2–4 require owned hotkey inventory records. */
  selectedAmmoSlot?: number;
  /** Rebuilt server-confirmed inventory table ID; first start/respawn/rematch reset to2001. */
  ammoItemId?: number;
  /** Rebuilt authority projection of the selected ammo count and computed capacity. */
  ammoMagazine?: {remaining: number; capacity: number};
  /** Rebuilt public battle loadout: special-slot table IDs and this round's remaining counts. */
  ammoSlots?: {slot: number; itemTableId: number; quantity: number}[];
  /** Rebuilt active item4 state; expiresAt is authoritative server milliseconds. */
  /** Rebuilt item5 mitigation state; armor values are captured before/after source recompute. */
  defenseBoost?: {skillId: number; expiresAt: number; defensePercent: number; defenseBonus: number;
    baseDefense: number; boostedDefense: number; source: 'original-attributes' | 'rebuilt-tank'};
  attackBoost?: {skillId: number; expiresAt: number; attackPercent: number; attackBonus: number};
  /** Rebuilt item8 immunity state; expiresAt is authoritative server milliseconds. */
  turnBoost?: {skillId: number; expiresAt: number; turnBonus: number};
  speedBoost?: {skillId: number; expiresAt: number; moveBonus: number};
  invincibility?: {skillId: number; expiresAt: number};
  /** Confirmed skill9 lifetime; enemy actor visibility is reconstructed from the client contract. */
  opticalCamouflage?: {skillId: 9; expiresAt: number};
  /** Confirmed disguise presence for new observers and late model loads. */
  roleDisguise?: RoleDisguiseSnapshot;
  /** Existing rebuilt2007 burn authority; presence controls retained4005 presentation. */
  trapRestraint?: {skillId: 4001; expiresAt: number; movePermissionCount: number};
  trapTurnRestraint?: {skillId: 4002; expiresAt: number; turnPermissionCount: number};
  trapFireRestraint?: {skillId: 4003; expiresAt: number; firePermissionCount: number};
  ammoBurn?: {itemId: 2007; skillId: 4005; startedAt: number; expiresAt: number};
  /** Rebuilt deadline projection: duration/remaining in seconds, startedAt in server milliseconds.
   * Zero startedAt means no shot in this life; duration excludes the original HUD's extra 0.5s.
   * Durations retain their original-normal or rebuilt source.
   */
  reload?: {duration: number; remaining: number; startedAt: number; source: 'original-normal' | 'rebuilt'};
  /** Worn title, present only when the account has an equipped title. */
  title?: PlayerTitle;
}

export interface PlayerTitle {
  id: number;
  name: string;
}

export interface ObjectiveSnapshot {
  id: string;
  kind: 'CAPTURE' | 'DESTROY';
  x: number;
  y: number;
  z: number;
  radius: number;
  hp: number;
  maxHp: number;
  ownerTeam: number;
  contested: boolean;
  /** Original placement ID; source scene objects render through ScenePreview. */
  sourcePlacementId?: string;
  sourceModel?: string;
  destroyedAt?: number;
}

/** Rebuilt ordinary environment authority, independent of gameplay objectives.
 * Identity/model/position come from original scene placements; Castle initial HP
 * comes from CAS. Breakable HP, attack permission and fade scheduling are rebuilt.
 */
export interface SceneObjectSnapshot {
  id: string;
  sourcePlacementId: string;
  sourceModel: string;
  x: number;
  y: number;
  z: number;
  hp: number;
  maxHp: number;
  destroyedAt?: number;
}

/** Original Crush visibility; shot permission and geometry selection are rebuilt. */
export interface SceneCrushSnapshot {
  id: string;
  sourcePlacementId: string;
  sourceModel: string;
  enabled: boolean;
  hidden: boolean;
}

/** Original Plant visibility; placement identity and participation are server adaptations. */
export interface ScenePlantSnapshot {
  id: string;
  sourcePlacementId: string;
  sourceModel: string;
  enabled: boolean;
  hidden: boolean;
}

/** Rebuilt ground object identity, world transform and authority deadline. */
export interface GroundTrapSnapshot {
  id: string;
  ownerId: string;
  team: number;
  itemTableId: 3001 | 3002 | 3003 | 3004 | 3005;
  modelId: 3001 | 3002 | 3003 | 3004 | 3005;
  x: number;
  y: number;
  z: number;
  expiresAt: number;
}

export interface AccountGrowth {
  rankPoints: number;
  level: number;
  originality: number;
  tech: number;
}

export interface ResultAward {
  money: number;
  coin: number;
  originality: number;
  tech: number;
  rankPoints: number;
  levelBefore: number;
  levelAfter: number;
  expPercent: number;
}

export interface ResultPlayer {
  id: string;
  name: string;
  team: number;
  rank: number;
  kills: number;
  deaths: number;
  objectivesDestroyed: number;
  combatScore: number;
  outcomeBonus: number;
  totalScore: number;
  outcome: 'WIN' | 'LOSE' | 'DRAW';
  award?: ResultAward;
}

export interface MatchResult {
  round: number;
  endedAt: number;
  reason: 'TIME_LIMIT' | 'OBJECTIVE' | 'FORFEIT';
  winnerTeam: number;
  winnerPlayerId: string;
  players: ResultPlayer[];
}

export interface MatchSnapshot {
  friendlyFire?: boolean;
  round: number;
  readyPlayerIds: string[];
  rematchPlayerIds: string[];
  minPlayers: number;
  maxPlayers?: number;
  targetScore: number;
  teamLives: number[];
  objectives: ObjectiveSnapshot[];
  /** Additive ordinary environment state; legacy fixtures may omit it. */
  sceneObjects?: SceneObjectSnapshot[];
  sceneCrushes?: SceneCrushSnapshot[];
  scenePlants?: ScenePlantSnapshot[];
  groundTraps?: GroundTrapSnapshot[];
  result?: MatchResult;
  cpuManagerId?: string;
}

export interface BulletSnapshot {
  id: string;
  ownerId: string;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  damage: number;
}

/** Authoritative rebuilt room metadata; optional for older presentation fixtures/servers. */
export interface RoomInfoSnapshot {
  name: string;
  mapId: number;
  mapName: string;
  mapDescription: string;
  timeLimitSeconds: number;
  hasPassword: boolean;
}

export interface MsgRoomSnapshot {
  roomInfo?: RoomInfoSnapshot;
  roomId: string;
  mode: number;
  serverTime: number;
  tick: number;
  remaining: number;
  phase: string;
  players: PlayerSnapshot[];
  bullets: BulletSnapshot[];
  teamScores: number[];
  winnerTeam: number;
  /** Additive contract; old explicit presentation fixtures can omit it. */
  match?: MatchSnapshot;
}

export type RoomSnapshot = MsgRoomSnapshot;
