import {applyPetInjection} from './items/pet-injection';
import {applyTrapSweep} from './items/trap-sweep-use';
import type {MsgPlayerInput, MsgRoomEvent} from '../../../shared/protocols';
import {dispatchItemHotkey} from './items/item-request-dispatch';
import type {PlayerState} from './player-state';
import {applyHealingItem} from './healing';
import {applyTreasureItemUse} from './items/treasure-item-use';
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
import {applyAirstrike} from './items/airstrike';
import type {RoomState} from '../rooms/state';
import {confirmAcceptedAmmoSelection} from './items/ammo-confirmation';
import {advanceAmmoRadarJam} from './items/ammo-radar-jam';
import {acceptClientTankPose} from './client-movement';
import {combatItems} from './catalog';

/** Accept ordinary human/CPU inputs or the participant's separate autopilot lane. */
export function acceptBattleInput(room: Pick<RoomState, 'roomId' | 'round' | 'phase' | 'startedAt' | 'mode' | 'map' | 'teamLives' | 'groundTraps' | 'sceneObjects' | 'airstrikes' | 'players' | 'battlefield'>, player: PlayerState,
  input: MsgPlayerInput, autonomous: boolean, maxHp: () => number,
  consumeItem: Parameters<typeof applyHealingItem>[4], now: number, tickMs: number): MsgRoomEvent[] {
  const {roomId, phase, startedAt} = room;
  if (phase !== 'PLAYING' || now < startedAt || !Number.isSafeInteger(input.sequence)
      || autonomous !== !!player.autopilot
      || input.sequence <= (autonomous ? player.autopilotInputSequence ?? 0 : player.inputSequence)) {
    return [];
  }
  if (!autonomous && !player.cpu && input.pose &&
      !acceptClientTankPose(room.round, player, input.pose, room.players.values(),
        room.battlefield.navigation)) return [];
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
  advanceAmmoRadarJam(roomId, player, now, requests);
  if (player.alive && player.input.useItem !== 0) {
    // Original request gates precede this rebuilt server selection/confirmation policy.
    dispatchItemHotkey(player.input.useItem, player.combat, player.inventory,
      slot => {
        if (!confirmAcceptedAmmoSelection(player.combat, player.inventory, slot)) return;
        recomputeBattleAttributes(player);
        requests.push({roomId, type: 'ammoSelected', message: '', playerId: player.id,
          targetId: player.id, value: slot, x: player.x, y: player.y, z: player.z,
          itemName: combatItems.get(player.combat.currentAmmoTableId)?.name});
      }, request => {
        requests.push({roomId, type: 'itemRequest', message: '', playerId: player.id,
          targetId: '', value: 0, x: 0, y: 0, z: 0, skillId: undefined, itemUseRequest: request});
        const item = player.inventory.find(item => item.instanceId === request.instanceId);
        const handler = item && combatItems.get(item.itemTableId)?.runtime.use;
        const handlers: Record<string, () => void> = {
          heal: () => {applyHealingItem(roomId, player, request, maxHp, consumeItem, requests);},
          treasure: () => {applyTreasureItemUse(roomId, player, request, maxHp, consumeItem, requests);},
          defense: () => {applyDefenseDrink(roomId, player, request, now, () => recomputeBattleAttributes(player), consumeItem, requests);},
          attack: () => {applyAttackDrink(roomId, player, request, now, () => recomputeBattleAttributes(player), consumeItem, requests);},
          invincibility: () => {applyInvincibility(roomId, player, request, now, () => recomputeBattleAttributes(player), consumeItem, requests);},
          camouflage: () => {applyOpticalCamouflage(roomId, player, request, now, () => recomputeBattleAttributes(player), consumeItem, requests);},
          disguise: () => {applyRoleDisguise(roomId, player, request, now, () => recomputeBattleAttributes(player), consumeItem, requests);},
          speed: () => {applySpeedDrink(roomId, player, request, now, () => recomputeBattleAttributes(player), consumeItem, requests);},
          turn: () => {applyTurnDrink(roomId, player, request, now, () => recomputeBattleAttributes(player), consumeItem, requests);},
          teamLife: () => {applyTeamLifeItem(room, player, request, consumeItem, requests);},
          building: () => {applyBuildingTool(room, player, request, consumeItem, requests, now);},
          cure: () => {applyPetInjection(roomId, player, request, consumeItem, requests, () => recomputeBattleAttributes(player));},
          trapSweep: () => {applyTrapSweep(room, player, request, now, consumeItem, requests);},
          airstrike: () => {applyAirstrike(room, player, request, now, tickMs, consumeItem, requests);},
        };
        if (handler) handlers[handler]?.();
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
    pose: input.pose ? {...input.pose} : undefined,
  };
}

function clamp(value: number): number {
  return Number.isFinite(value) ? Math.max(-1, Math.min(1, value)) : 0;
}
