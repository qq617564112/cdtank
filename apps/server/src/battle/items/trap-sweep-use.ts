import type {MsgRoomEvent} from '../../../../shared/protocols';
import type {RoomState} from '../../rooms/state';
import type {PetInjectionParticipant} from './pet-injection';
import type {ConsumeAmmoItem} from './ammo-consumption';
import {combatItems} from '../catalog';
import {readTrapSweepRule, selectSweepTraps} from './trap-sweep';

/** Rebuilt Func14 removes selected ground traps only after durable item consumption. */
export function applyTrapSweep(room: Pick<RoomState, 'roomId' | 'phase' | 'groundTraps'>,
  player: PetInjectionParticipant, request: {kind: string; instanceId: number}, now: number,
  consume: ConsumeAmmoItem | undefined, events: MsgRoomEvent[]): void {
  if (request.kind !== 'useItem' || room.phase !== 'PLAYING' || !player.alive || player.combat.status !== 2) return;
  const item = player.inventory.find(record => record.instanceId === request.instanceId);
  const rule = item ? readTrapSweepRule(item.itemTableId) : undefined;
  if (!rule || !item || item.itemTableId !== rule.itemTableId || item.ownedQuantity <= 0 || item.battleQuantity <= 0) return;
  const reject = (message: string): void => {
    events.push({roomId: room.roomId, type: 'itemRejected', message, playerId: player.id,
      targetId: '', value: 0, x: player.x, y: player.y, z: player.z});
  };
  const selected = selectSweepTraps(room.groundTraps, player, now, rule.radius);
  if (!selected.length) {reject('附近没有需要清除的捕兽夹'); return;}
  try {
    if (consume && !consume(player.id, item.instanceId, item.ownedQuantity, item.itemTableId)) {
      reject('物品数量已变化，请重新进入房间'); return;
    }
  } catch {reject('物品保存失败，请稍后再试'); return;}
  item.ownedQuantity--;
  item.battleQuantity--;
  const removed = new Set(selected);
  room.groundTraps = room.groundTraps.filter(trap => !removed.has(trap));
  events.push({roomId: room.roomId, type: 'itemUsed', itemName: combatItems.get(item.itemTableId)?.name, message: `${player.name}使用${combatItems.get(item.itemTableId)!.name}`,
    playerId: player.id, targetId: player.id, value: selected.length,
    x: player.x, y: player.y, z: player.z, skillId: rule.skillId,
    playSkillEffect: {skillId: rule.skillId, effectIndex: 0, duration: 0,
      roleId: Number(player.id.slice(1)), xBits: 0, zBits: 0}});
}
