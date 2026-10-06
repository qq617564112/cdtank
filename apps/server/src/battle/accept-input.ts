import {applyPetInjection} from './items/pet-injection';
import {applyTrapSweep} from './items/trap-sweep-use';
import type {MsgPlayerInput, MsgRoomEvent} from '../../../shared/protocols';
import {dispatchItemHotkey} from './items/item-request-dispatch';
import type {PlayerState} from './player-state';
import {applyHealingItem} from './healing';
import {applyAttackDrink, advanceAttackDrink} from './items/attack-drink';
import {applyDefenseDrink, advanceDefenseDrink} from './items/defense-drink';
import {recomputeBattleAttributes} from './attributes';
import {applyTurnDrink, advanceTurnDrink} from './items/turn-drink';
import {applySpeedDrink, advanceSpeedDrink} from './items/speed-drink';
import {applyInvincibility, advanceInvincibility} from './items/invincibility';
import {applyOpticalCamouflage, advanceOpticalCamouflage} from './items/optical-camouflage';
import {applyRoleDisguise, advanceRoleDisguise} from './items/role-disguise';
import {applyTeamLifeItem} from './items/team-life';
import {applyBuildingTool} from './items/building-tool';
import type {RoomState} from '../rooms/state';
import {confirmAcceptedAmmoSelection} from './items/ammo-confirmation';

/** Accept ordinary human/CPU inputs or the participant's separate autopilot lane. */
export function acceptBattleInput(room: Pick<RoomState, 'roomId' | 'phase' | 'mode' | 'map' | 'teamLives' | 'groundTraps' | 'sceneObjects'>, player: PlayerState,
  input: MsgPlayerInput, autonomous: boolean, maxHp: () => number,
  consumeItem: Parameters<typeof applyHealingItem>[4], now: number): MsgRoomEvent[] {
  const {roomId, phase} = room;
  if (phase !== 'PLAYING' || !Number.isSafeInteger(input.sequence)
      || autonomous !== !!player.autopilot
      || input.sequence <= (autonomous ? player.autopilotInputSequence ?? 0 : player.inputSequence)) {
    return [];
  }
  player.input = normalizeInput(input);
  if (autonomous) player.autopilotInputSequence = input.sequence;
  else player.inputSequence = input.sequence;
  const requests: MsgRoomEvent[] = [];
  advanceDefenseDrink(roomId, player, now, () => recomputeBattleAttributes(player), requests);
  advanceAttackDrink(roomId, player, now, () => recomputeBattleAttributes(player), requests);
  advanceInvincibility(roomId, player, now, () => recomputeBattleAttributes(player), requests);
  advanceOpticalCamouflage(roomId, player, now, () => recomputeBattleAttributes(player), requests);
  advanceRoleDisguise(roomId, player, now, () => recomputeBattleAttributes(player), requests);
  advanceSpeedDrink(roomId, player, now, () => recomputeBattleAttributes(player), requests);
  advanceTurnDrink(roomId, player, now, () => recomputeBattleAttributes(player), requests);
  if (player.alive && player.input.useItem !== 0) {
    // Original request gates precede this rebuilt server selection/confirmation policy.
    dispatchItemHotkey(player.input.useItem, player.combat, player.inventory,
      slot => {
        if (confirmAcceptedAmmoSelection(player.combat, player.inventory, slot)) recomputeBattleAttributes(player);
      }, request => {
        requests.push({roomId, type: 'itemRequest', message: '', playerId: player.id,
          targetId: '', value: 0, x: 0, y: 0, z: 0, skillId: undefined, itemUseRequest: request});
        applyHealingItem(roomId, player, request, maxHp, consumeItem, requests);
        applyDefenseDrink(roomId, player, request, now, () => recomputeBattleAttributes(player), consumeItem, requests);
        applyAttackDrink(roomId, player, request, now, () => recomputeBattleAttributes(player), consumeItem, requests);
        applyInvincibility(roomId, player, request, now, () => recomputeBattleAttributes(player), consumeItem, requests);
        applyOpticalCamouflage(roomId, player, request, now, () => recomputeBattleAttributes(player), consumeItem, requests);
        applyRoleDisguise(roomId, player, request, now, () => recomputeBattleAttributes(player), consumeItem, requests);
        applySpeedDrink(roomId, player, request, now, () => recomputeBattleAttributes(player), consumeItem, requests);
        applyTurnDrink(roomId, player, request, now, () => recomputeBattleAttributes(player), consumeItem, requests);
        applyTeamLifeItem(room, player, request, consumeItem, requests);
        applyBuildingTool(room, player, request, consumeItem, requests);
        applyPetInjection(roomId, player, request, consumeItem, requests, () => recomputeBattleAttributes(player));
        applyTrapSweep(room, player, request, now, consumeItem, requests);
      });
  }
  return requests;
}

function normalizeInput(input: MsgPlayerInput): MsgPlayerInput {
  return {
    sequence: Math.max(0, Math.floor(input.sequence)),
    move: clamp(input.move), turn: clamp(input.turn), aim: clamp(input.aim),
    fire: !!input.fire,
    useItem: Number.isInteger(input.useItem) ? input.useItem : 0,
    clientTime: Number.isFinite(input.clientTime) ? input.clientTime : 0,
  };
}

function clamp(value: number): number {
  return Number.isFinite(value) ? Math.max(-1, Math.min(1, value)) : 0;
}
