import {BotController} from '../battle/cpu/controller';
import {createOriginalBotNavigation} from '../battle/cpu/original-navigation';
import {createBattleMovementPredictor, createBattleMovementRollout} from '../battle/dynamic-movement';
import {originalMovementParameters} from '../battle/movement';
import {isRoleFireReady} from '../battle/roles/reload';
import type {PlayerState} from '../battle/player-state';
import type {RoomState} from '../rooms/state';

/** Offline labels from the existing CPU, including its navigation and team context. */
export class LearningCombatExpert {
  private readonly controllers = new WeakMap<PlayerState, {deaths: number; controller: BotController}>();

  input(room: RoomState, player: PlayerState, maximumHp: number, now: number) {
    let state = this.controllers.get(player);
    if (!state || state.deaths !== player.deaths) {
      state = {deaths: player.deaths, controller: new BotController('HIGH')};
      this.controllers.set(player, state);
    }
    if (!player.alive) return {move: 0, turn: 0, aim: 0, fire: false, useItem: 0};
    const parameters = originalMovementParameters(player);
    return state.controller.input({...player, cpu: state.controller, maxHp: maximumHp,
      movementReady: parameters !== undefined,
      fireReady: !player.combat.pendingShot && isRoleFireReady(player.combat.getFlag(11) !== 0,
        (now - room.startedAt) / 1000, player.combat.nextAvailableSeconds),
      movement: parameters ? {...parameters, navigation: createOriginalBotNavigation(room.battlefield),
        predict: createBattleMovementPredictor(player, room.battlefield, room.players.values(), .1),
        rollout: createBattleMovementRollout(player, room.battlefield, room.players.values())} : undefined},
    [...room.players.values()].map(actor => {
      const teammate = this.controllers.get(actor);
      return teammate ? {...actor, cpu: teammate.controller} : actor;
    }), room.objectives, room.battlefield, room.mode, now, .1,
    {mode: room.mode, team: player.team, initialLives: room.map.tankLimit, lives: room.teamLives}, room);
  }
}
