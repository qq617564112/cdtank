import type {MsgRoomEvent} from '../../../../shared/protocols';
import type {InventoryWireRecord} from '../../../../shared/protocols/PtlInventory';
import type {RoleCombatState} from '../roles/combat-state';
import {combatItems, combatSkills} from '../catalog';

export interface TeamLifeRoom {
  roomId: string;
  mode: number;
  teamLives: number[];
}

export interface TeamLifeParticipant {
  id: string;
  name: string;
  team: number;
  alive: boolean;
  x: number;
  y: number;
  z: number;
  combat: RoleCombatState;
  inventory: InventoryWireRecord[];
}

/** Rebuilt self-use and mode1 authority for source skill501 FuncType18 x1/y1. */
export function applyTeamLifeItem(room: TeamLifeRoom, player: TeamLifeParticipant,
  request: {kind: string; instanceId: number},
  consumeItem: ((playerId: string, instanceId: number, expectedOwned: number,
    itemTableId: number) => boolean) | undefined, events: MsgRoomEvent[]): void {
  if (request.kind !== 'useItem') return;
  const item = player.inventory.find(record => record.instanceId === request.instanceId);
  if (!item || item.itemTableId !== 501) return;
  const definition = combatItems.get(501);
  const skill = definition ? combatSkills.get(definition.skillIds[0]) : undefined;
  if (!skill || skill.skillId !== 501 || skill.target !== 1 || skill.triggerType !== 1
      || skill.functions[0]?.type !== 18 || skill.functions[0].x !== 1
      || skill.functions[0].y !== 1) return;
  const reject = (message: string): void => {
    events.push({roomId: room.roomId, type: 'itemRejected', message, playerId: player.id,
      targetId: '', value: 0, x: 0, y: 0, z: 0});
  };
  if (room.mode !== 1) {
    reject('1UP仅可在团队模式使用');
    return;
  }
  if (!player.alive || player.combat.status !== 2
      || item.ownedQuantity <= 0 || item.battleQuantity <= 0) return;
  if ((player.team !== 0 && player.team !== 1) || room.teamLives.length !== 2
      || !room.teamLives.every(lives => Number.isFinite(lives)
        && Number.isInteger(lives) && lives > 0)
      || !Number.isSafeInteger(room.teamLives[player.team] + 1)) {
    reject('团队存量无效，无法使用道具');
    return;
  }
  try {
    if (consumeItem && !consumeItem(player.id, item.instanceId, item.ownedQuantity, item.itemTableId)) {
      reject('物品数量已变化，请重新进入房间');
      return;
    }
  } catch {
    reject('物品保存失败，请稍后再试');
    return;
  }
  item.ownedQuantity -= 1;
  item.battleQuantity -= 1;
  room.teamLives[player.team] += 1;
  events.push({roomId: room.roomId, type: 'itemUsed', message: `${player.name}使用${definition!.name}`,
    playerId: player.id, targetId: player.id, value: 1,
    x: player.x, y: player.y, z: player.z, skillId: 501,
    playSkillEffect: {skillId: 501, effectIndex: 0, duration: 0,
      roleId: Number(player.id.slice(1)), xBits: 0, zBits: 0}});
}
