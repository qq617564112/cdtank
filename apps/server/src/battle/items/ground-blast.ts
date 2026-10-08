import {itemTrapHandler} from '../../../../shared/content/catalog';
import {combatItems, combatSkills} from '../catalog';
import type {MsgRoomEvent, PlaySkillEffectMessage} from '../../../../shared/protocols';
import type {PlayerState} from '../player-state';
import type {RoomState} from '../../rooms/state';

export interface GroundBlastRule {
  itemTableId: number;
  placementSkillId: number;
  blastSkillId: number;
  damageSkillId: number;
  groundModelId: number;
  groundDurationMs: number;
  triggerRadius: number;
  blastWidth: number;
  damage: number;
}

function readGroundBlastRuleFor(itemId: number): GroundBlastRule | undefined {
  const item = combatItems.get(itemId);
  const placement = item ? combatSkills.get(item.skillIds[0]) : undefined;
  const create = placement?.functions[0];
  const blast = create ? combatSkills.get(create.y) : undefined;
  const effect = blast?.functions[0];
  const damage = effect ? combatSkills.get(effect.y) : undefined;
  const blastWidth = item?.runtime.values.blastWidth;
  if (!item || item.itemType !== 4 || item.runtime.trap !== 'blast'
      || !placement || !create || create.type !== 12
      || !blast || blast.triggerType !== 1 || blast.target !== 4
      || effect?.type !== 15 || !damage || damage.functions[0]?.type !== 2
      || damage.attributes.HP >= 0 || create.t <= 0 || create.x <= 0 || create.z <= 0
      || blastWidth === undefined || !Number.isInteger(blastWidth) || blastWidth <= 0) return undefined;
  return {itemTableId: item.itemTableId, placementSkillId: placement.skillId,
    blastSkillId: blast.skillId, damageSkillId: damage.skillId,
    groundModelId: create.z, groundDurationMs: create.t * 1000,
    triggerRadius: create.x, blastWidth, damage: -damage.attributes.HP};
}

/** The caller is a real placed object; item3007's group-restraint behavior stays untouched. */
export function readGroundBlastRule(itemId: number): GroundBlastRule | undefined {
  return readGroundBlastRuleFor(itemId);
}

function floatBits(value: number): number {
  const view = new DataView(new ArrayBuffer(4));
  view.setFloat32(0, value, true);
  return view.getUint32(0, true);
}

export function groundBlastWorldEffect(skillId: number, x: number, z: number): PlaySkillEffectMessage {
  return {skillId, effectIndex: 0, duration: 0, roleId: 0, xBits: floatBits(x), zBits: floatBits(z)};
}

/** One contact resolves the blast square once, before a lethal hit can clear the room. */
export function advanceGroundBlasts(room: RoomState, now: number, events: MsgRoomEvent[],
  hit: (owner: PlayerState, target: PlayerState, damage: number, skillId: number) => void,
  resolve: (damage: () => void) => void): void {
  if (room.phase !== 'PLAYING') return;
  for (const trap of [...room.groundTraps]) {
    if (room.phase !== 'PLAYING') break;
    if (itemTrapHandler(trap.itemTableId) !== 'blast') continue;
    const rule = readGroundBlastRule(trap.itemTableId);
    if (!rule) continue;
    const owner = room.players.get(trap.ownerId);
    if (!owner) {
      room.groundTraps = room.groundTraps.filter(value => value.id !== trap.id);
      continue;
    }
    const expired = now >= trap.expiresAt;
    const contact = expired ? undefined : [...room.players.values()].find(target =>
      target.id !== trap.ownerId && target.alive && target.combat.status === 2
      && (room.mode > 3 || target.team !== trap.team)
      && Math.hypot(target.x - trap.x, target.z - trap.z) <= rule.triggerRadius);
    if (!expired && !contact) continue;
    room.groundTraps = room.groundTraps.filter(value => value.id !== trap.id);
    events.push({roomId: room.roomId, type: 'trapTriggered', message: '',
      playerId: owner.id, targetId: contact?.id ?? trap.id, value: 0,
      x: trap.x, y: trap.y, z: trap.z, skillId: rule.blastSkillId,
      playSkillEffect: groundBlastWorldEffect(rule.blastSkillId, trap.x, trap.z)});
    const half = rule.blastWidth / 2;
    resolve(() => {
      for (const target of room.players.values()) {
        if (room.phase !== 'PLAYING') break;
        if (target.id === owner.id || !target.alive || target.combat.status !== 2
            || (room.mode <= 3 && target.team === trap.team)
            || Math.abs(target.x - trap.x) > half || Math.abs(target.z - trap.z) > half) continue;
        hit(owner, target, rule.damage, rule.damageSkillId);
      }
    });
  }
}
