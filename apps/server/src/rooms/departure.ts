import type {MsgRoomEvent} from '../../../shared/protocols';
import type {PlayerState} from '../battle/player-state';
import {forfeitOutcome, type ModeOutcome} from '../modes/outcomes';
import {matchFinishMessage} from '../settlement/match-result';
import type {RoomState} from './state';
import {canStartRoom, readyCpus} from './preparation';
import {ensureDefaultRooms} from './availability';
import {resetBreachCollision} from '../battle/breach-collision';
import {resetSceneObjectCollision} from '../battle/environment';

/** Settle the current roster before removal; then reconcile the remaining room. */
export function leaveRoomPlayer(rooms: Map<string, RoomState>, room: RoomState,
  player: PlayerState, minPlayers: number, actions: {
    finish(outcome: ModeOutcome): void;
    /** Freeze an ordinary mid-round participant before removal; not called for immediate FORFEIT. */
    departed(player: PlayerState): void;
    create(mode: number): void;
    start(): void;
    rematch(): void;
  }): MsgRoomEvent[] {
  const events: MsgRoomEvent[] = [{roomId: room.roomId, type: 'leave',
    message: `${player.name}离开了战斗`, playerId: player.id, targetId: '',
    value: 0, x: 0, y: 0, z: 0, skillId: undefined}];
  const outcome = forfeitOutcome(room, player);
  if (outcome) {
    actions.finish(outcome);
    events.push({roomId: room.roomId, type: 'finish',
      message: matchFinishMessage(room.result, room.winnerTeam), playerId: player.id,
      targetId: '', value: 0, x: 0, y: 0, z: 0, skillId: undefined});
  } else if (room.phase === 'PLAYING') {
    actions.departed(player);
  }
  player.boundGear = undefined;
  player.lastStand = undefined;
  room.players.delete(player.id);
  room.ready.delete(player.id);
  room.loaded.delete(player.id);
  room.rematch.delete(player.id);
  room.bullets = room.bullets.filter(bullet => bullet.ownerId !== player.id);
  if (![...room.players.values()].some(value => !value.cpu)) {
    resetBreachCollision(room.battlefield);
    resetSceneObjectCollision(room.battlefield);
    rooms.delete(room.roomId);
    ensureDefaultRooms(rooms, actions.create);
  } else if (room.phase === 'LOADING') {
    room.phase = 'WAITING';
    room.loaded.clear();
    room.ready.clear();
    readyCpus(room);
  } else if (room.phase === 'WAITING' && canStartRoom(room, minPlayers)
      && room.ready.size === room.players.size) {
    actions.start();
  } else {
    actions.rematch();
  }
  return events;
}
