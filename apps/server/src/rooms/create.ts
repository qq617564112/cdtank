import {selectPlayerLimits} from './player-limits';
import {getMapConfig} from '../config';
import {createRoomBattlefield} from '../battlefield';
import type {RoomState} from './state';
import {validateRoomTimeLimit} from '../../../shared/room-time-limit';

export function modeName(mode: number): string {
  return ['团队模式', '占领模式', '擒王模式', '混战模式', '破坏模式'][mode - 1] ?? '战斗';
}

/** Build the actual waiting room after resolving its source map. */
export function createWaitingRoom(mode: number, mapId: number | undefined,
  allocateId: () => string, minPlayers?: number, maxPlayers?: number, friendlyFire = false,
  timeLimitSeconds?: number): RoomState {
  const map = getMapConfig(mode, mapId);
  validateRoomTimeLimit(timeLimitSeconds);
  return {
    roomId: allocateId(),
    roomName: `${modeName(mode)}·${map.name}`,
    mode,
    friendlyFire,
    timeLimitSeconds,
    map,
    ...selectPlayerLimits(map, minPlayers, maxPlayers),
    battlefield: createRoomBattlefield(map.mapId),
    players: new Map(),
    bullets: [],
    phase: 'WAITING',
    startedAt: 0,
    endedAt: 0,
    teamScores: [0, 0],
    winnerTeam: -1,
    round: 1,
    ready: new Set(),
    loaded: new Set(),
    rematch: new Set(),
    teamLives: [],
    objectives: [],
    sceneObjects: [],
    sceneCrushes: [],
    scenePlants: [],
    groundTraps: [],
    groundItems: [],
    airstrikes: [],
    targetScore: mode === 2 ? map.bunkerHp : 0,
    tick: 0,
  };
}
