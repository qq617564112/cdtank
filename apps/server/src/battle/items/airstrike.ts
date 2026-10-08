import {itemForHandler} from '../../../../shared/content/catalog';
import type {MsgRoomEvent, PlaySkillEffectMessage} from '../../../../shared/protocols';
import type {PlayerState} from '../player-state';
import type {RoomState} from '../../rooms/state';
import {combatItems, combatSkills} from '../catalog';

export interface AirstrikeRule {
  itemTableId: number;
  castSkillId: number;
  areaSkillId: number;
  damageSkillId: number;
  /** Original Func16 X20 adopted as 20 server ticks. */
  delayTicks: number;
  range: number;
  damage: number;
}

/** Original 13→13 Func16 X20/Y3013, 3013 Func15 Y3012, 3012 Func2 HP-300. */
export function readAirstrikeRule(itemId = itemForHandler('use', 'airstrike').id): AirstrikeRule | undefined {
  const item = combatItems.get(itemId);
  const cast = item ? combatSkills.get(item.skillIds[0]) : undefined;
  const create = cast?.functions[0];
  const area = create ? combatSkills.get(create.y) : undefined;
  const effect = area?.functions[0];
  const damage = effect ? combatSkills.get(effect.y) : undefined;
  if (!item || !cast || create?.type !== 16 || create.x <= 0 || !area || area.range <= 0
      || effect?.type !== 15 || !damage || damage.functions[0]?.type !== 2
      || damage.attributes.HP >= 0) return;
  return {itemTableId: item.itemTableId, castSkillId: cast.skillId, areaSkillId: area.skillId,
    damageSkillId: damage.skillId, delayTicks: create.x, range: area.range, damage: -damage.attributes.HP};
}

function floatBits(value: number): number {
  const view = new DataView(new ArrayBuffer(4));
  view.setFloat32(0, value, true);
  return view.getUint32(0, true);
}

/** roleId0 selects the world-position branch of the existing skill effect consumer. */
export function airstrikeWorldEffect(skillId: number, x: number, z: number): PlaySkillEffectMessage {
  return {skillId, effectIndex: 0, duration: 0, roleId: 0, xBits: floatBits(x), zBits: floatBits(z)};
}

export type AirstrikeParticipant = Pick<PlayerState,
  'id' | 'name' | 'team' | 'alive' | 'x' | 'y' | 'z' | 'combat' | 'inventory'>;

/** CAS persistence precedes the owned/battle quantity decrement. */
export function applyAirstrike(room: Pick<RoomState, 'roomId' | 'phase' | 'airstrikes'>,
  player: AirstrikeParticipant, request: {kind: string; instanceId: number}, now: number,
  tickMs: number, consumeItem: ((playerId: string, instanceId: number, expectedOwned: number,
    itemTableId: number) => boolean) | undefined, events: MsgRoomEvent[]): void {
  if (request.kind !== 'useItem' || room.phase !== 'PLAYING'
      || !player.alive || player.combat.status !== 2) return;
  const item = player.inventory.find(record => record.instanceId === request.instanceId);
  if (!item || combatItems.get(item.itemTableId)?.runtime.use !== 'airstrike' || item.ownedQuantity <= 0 || item.battleQuantity <= 0) return;
  const rule = readAirstrikeRule(item.itemTableId);
  if (!rule || !Number.isFinite(tickMs) || tickMs <= 0) return;
  const reject = (message: string): void => {
    events.push({roomId: room.roomId, type: 'itemRejected', message, playerId: player.id,
      targetId: '', value: 0, x: 0, y: 0, z: 0});
  };
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
  // The authoritative role XZ is the blast centre; the client sends no vector.
  const x = player.x, y = player.y, z = player.z;
  room.airstrikes.push({ownerId: player.id, team: player.team, x, y, z,
    resolvesAt: now + rule.delayTicks * tickMs, sourceSkillId: rule.castSkillId});
  events.push({roomId: room.roomId, type: 'itemUsed', itemName: combatItems.get(item.itemTableId)?.name, message: `${player.name}使用${combatItems.get(item.itemTableId)!.name}`,
    playerId: player.id, targetId: player.id, value: item.battleQuantity, x, y, z, skillId: rule.castSkillId,
    playSkillEffect: airstrikeWorldEffect(rule.castSkillId, x, z)});
}

function insideArea(dx: number, dz: number, range: number): boolean {
  const half = range / 2;
  return Math.abs(dx) <= half && Math.abs(dz) <= half;
}

/** One-shot expiry: emit the 3013 impact, then the terminal 3012 direct damage. */
export function advanceAirstrikes(room: Pick<RoomState, 'roomId' | 'phase' | 'mode' | 'players' | 'airstrikes'>,
  now: number, events: MsgRoomEvent[],
  hit: (owner: PlayerState, target: PlayerState, damage: number, skillId: number) => void): void {
  if (room.phase !== 'PLAYING') return;
  for (const pending of [...room.airstrikes]) {
    if (room.phase !== 'PLAYING') break;
    if (now < pending.resolvesAt) continue;
    const item = [...combatItems.values()].find(item => item.runtime.use === 'airstrike'
      && item.runtime.skillRoles.primary === pending.sourceSkillId);
    const rule = item ? readAirstrikeRule(item.itemTableId) : undefined;
    // Remove before life settlement: a lethal hit may finish and clear the collection.
    room.airstrikes = room.airstrikes.filter(value => value !== pending);
    const owner = room.players.get(pending.ownerId);
    if (!owner || !rule || pending.sourceSkillId !== rule.castSkillId) continue;
    events.push({roomId: room.roomId, type: 'airstrikeImpact', message: '',
      playerId: owner.id, targetId: '', value: 0,
      x: pending.x, y: pending.y, z: pending.z, skillId: rule.areaSkillId,
      playSkillEffect: airstrikeWorldEffect(rule.areaSkillId, pending.x, pending.z)});
    for (const target of room.players.values()) {
      if (room.phase !== 'PLAYING') break;
      if (target.id === owner.id || !target.alive || target.combat.status !== 2
          || (room.mode <= 3 && target.team === pending.team)
          || !insideArea(target.x - pending.x, target.z - pending.z, rule.range)) continue;
      hit(owner, target, rule.damage, rule.damageSkillId);
    }
  }
}
