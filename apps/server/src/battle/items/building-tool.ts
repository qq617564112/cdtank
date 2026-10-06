import type {MsgRoomEvent, SceneObjectSnapshot} from '../../../../shared/protocols';
import type {InventoryWireRecord} from '../../../../shared/protocols/PtlInventory';
import type {RoleCombatState} from '../roles/combat-state';
import {combatItems, combatSkills} from '../catalog';
import {getSceneCastles} from '../../scene-objects';

export interface BuildingToolRoom {
  roomId: string;
  phase: string;
  mode: number;
  map: {mapId: number};
  sceneObjects: SceneObjectSnapshot[];
}

export interface BuildingToolParticipant {
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

/** Rebuilt Target1/Range0 policy selects the first own damaged living Castle
 *  in source placement order without adding a client target payload. */
export function selectBuildingToolTarget(mapId: number, sceneObjects: readonly SceneObjectSnapshot[],
  team: number): SceneObjectSnapshot | undefined {
  if (team !== 0 && team !== 1) return undefined;
  const affiliation = team + 1;
  for (const source of getSceneCastles(mapId)) {
    if (source.affiliation !== affiliation) continue;
    const object = sceneObjects.find(candidate => candidate.id === `CASTLE:${source.id}`
      && candidate.sourcePlacementId === source.id && candidate.sourceModel === source.model);
    if (object && object.hp > 0 && object.hp < object.maxHp) return object;
  }
  return undefined;
}

/** Rebuilt ordinary use of item502/skill502 FuncType18 x2/y5000 restoring an own Castle. */
export function applyBuildingTool(room: BuildingToolRoom, player: BuildingToolParticipant,
  request: {kind: string; instanceId: number},
  consumeItem: ((playerId: string, instanceId: number, expectedOwned: number,
    itemTableId: number) => boolean) | undefined, events: MsgRoomEvent[]): void {
  if (request.kind !== 'useItem') return;
  const item = player.inventory.find(record => record.instanceId === request.instanceId);
  if (!item || item.itemTableId !== 502) return;
  const definition = combatItems.get(502);
  const skill = definition ? combatSkills.get(definition.skillIds[0]) : undefined;
  if (!definition || !skill || skill.skillId !== 502 || skill.target !== 1
      || skill.triggerType !== 1 || skill.range !== 0 || skill.functions[0]?.type !== 18
      || skill.functions[0].x !== 2 || skill.functions[0].y !== 5000) return;
  const reject = (message: string): void => {
    events.push({roomId: room.roomId, type: 'itemRejected', message, playerId: player.id,
      targetId: '', value: 0, x: 0, y: 0, z: 0});
  };
  if (room.mode !== 1) {
    reject('建筑工具仅可在团队模式使用');
    return;
  }
  if (!player.alive || player.combat.status !== 2
      || item.ownedQuantity <= 0 || item.battleQuantity <= 0) return;
  const target = selectBuildingToolTarget(room.map.mapId, room.sceneObjects, player.team);
  if (!target) {
    reject('没有可修复的我方碉堡');
    return;
  }
  const restored = Math.min(skill.functions[0].y, target.maxHp - target.hp);
  if (!Number.isFinite(restored) || restored <= 0) {
    reject('碉堡无需修复');
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
  target.hp += restored;
  events.push({roomId: room.roomId, type: 'itemUsed',
    message: `${player.name}使用${definition.name}，恢复${restored}生命`,
    playerId: player.id, targetId: target.id, value: restored,
    x: player.x, y: player.y, z: player.z, skillId: 502,
    playSkillEffect: {skillId: 502, effectIndex: 0, duration: 0,
      roleId: Number(player.id.slice(1)), xBits: 0, zBits: 0}});
  events.push({roomId: room.roomId, type: 'sceneObjectHealed',
    message: `${player.name}修复碉堡`, playerId: player.id, targetId: target.id,
    value: restored, x: target.x, y: target.y, z: target.z,
    castleDamage: {castleId: target.sourcePlacementId, currentHP: target.hp,
      maxHP: target.maxHp, delta: -restored}});
}
