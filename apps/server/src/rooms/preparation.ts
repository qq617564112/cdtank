import {roomMaxPlayers} from './player-limits';
interface RoomParticipant {
  id: string;
  team: number;
  cpu?: unknown;
}

interface PreparationRoom {
  mode: number;
  phase: 'WAITING' | 'PLAYING' | 'FINISHED';
  round: number;
  map: {maxPlayers: number};
  maxPlayers?: number;
  players: ReadonlyMap<string, RoomParticipant>;
  ready: Set<string>;
  rematch: Set<string>;
}

// Existing rebuilt start policy; original server authority remains unresolved.
export function canStartRoom(room: PreparationRoom, minPlayers: number): boolean {
  return room.players.size >= minPlayers && (room.mode > 3
    || [0, 1].every(team => [...room.players.values()].some(player => player.team === team)));
}

export function readyCpus(room: PreparationRoom): void {
  for (const player of room.players.values()) if (player.cpu) room.ready.add(player.id);
}

/** Change the vote, returning whether World should start the waiting round. */
export function setReady(room: PreparationRoom, playerId: string, isReady: boolean,
  minPlayers: number): boolean {
  if (room.phase === 'FINISHED') throw new Error('请在结算后选择再来一局');
  if (room.phase === 'WAITING') {
    if (isReady) room.ready.add(playerId);
    else room.ready.delete(playerId);
    return canStartRoom(room, minPlayers) && room.ready.size === room.players.size;
  }
  if (!isReady) throw new Error('开局后不能取消准备');
  return false;
}

/** World validates membership, current round and WAITING before invoking. */
export function changeWaitingTeam(room: PreparationRoom, player: RoomParticipant, team: number): number {
  if (room.mode > 3) throw new Error('个人战模式不能选择队伍');
  if (team !== 0 && team !== 1) throw new Error('队伍不存在');
  if (player.team === team) return team;
  const capacity = Math.ceil(roomMaxPlayers(room) / 2);
  if ([...room.players.values()].filter(value => value.team === team).length >= capacity) {
    throw new Error('该队已满');
  }
  player.team = team;
  // Everyone must acknowledge the new composition before starting.
  room.ready.clear();
  readyCpus(room);
  return team;
}

export function voteRematch(room: PreparationRoom, playerId: string): void {
  for (const player of room.players.values()) if (player.cpu) room.rematch.add(player.id);
  room.rematch.add(playerId);
}

/** Commit the next round vote/number; World resets combat and starts it. */
export function prepareRematch(room: PreparationRoom, minPlayers: number): boolean {
  if (room.phase !== 'FINISHED' || !canStartRoom(room, minPlayers)
      || room.rematch.size !== room.players.size) return false;
  room.round++;
  room.ready = new Set(room.players.keys());
  return true;
}
