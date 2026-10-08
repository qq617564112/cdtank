import {gameContent} from '../../../../shared/content/catalog';
import type {PlaySkillEffectMessage, StopSkillEffectMessage} from '../../../../shared/protocols/MsgRoomEvent';

export interface SkillEffectSlot {
  effectId: number;
  tag: number;
  sound: string;
}
export interface SkillEffectDefinition {effects: readonly SkillEffectSlot[];}
export interface SkillEffectNotificationRecord<Effect, Sound> {
  roleId: number;
  skillId: number;
  effectIndex: number;
  duration: number;
  effect?: Effect;
  sound?: Sound;
}
export interface SkillEffectNotificationBackend<Role, Effect, Sound> {
  skill(skillId: number): SkillEffectDefinition | undefined;
  role(roleId: number): Role | undefined;
  hasActor(role: Role): boolean;
  world(name: string, position: readonly [number, number, number], sourceFlag: 1): void;
  attached(role: Role, effectId: number, argument2: 3, effectTag: number, oneShot: boolean): Effect;
  sound(role: Role, reference: string, selector: 1 | -1, offset: readonly [number, number, number]): Sound;
  /** World-position skill WAV; supplied only where the adopted business policy owns one. */
  worldSound?(reference: string, position: readonly [number, number, number], selector: 1 | -1): void;
  stopEffect(effect: Effect): void;
  stopSound(sound: Sound): void;
  release(record: SkillEffectNotificationRecord<Effect, Sound>): void;
  resetRoleEffects(roleId: number): void;
}

const SOUND_OFFSET: readonly [number, number, number] = [0, 0, -1];

/** Original 488291/486b4a notifications and 48698f simulation-tick countdown updates. */
export class SkillEffectNotifications<Role, Effect, Sound> {
  private readonly retained: SkillEffectNotificationRecord<Effect, Sound>[] = [];
  private readonly roleQueues = new Map<number, SkillEffectNotificationRecord<Effect, Sound>[]>();
  private accumulated = 0;
  private readonly timers = new Map<number, {skillId: number; remaining: number}>();
  constructor(private readonly backend: SkillEffectNotificationBackend<Role, Effect, Sound>) {}

  get records(): readonly Readonly<SkillEffectNotificationRecord<Effect, Sound>>[] {return this.retained;}
  get queues(): ReadonlyMap<number, readonly Readonly<SkillEffectNotificationRecord<Effect, Sound>>[]> {return this.roleQueues;}
  get updateAccumulator(): number {return this.accumulated;}
  get queueTimers(): ReadonlyMap<number, Readonly<{skillId: number; remaining: number}>> {return this.timers;}

  /**
   * Airstrike sound adoption: play the source slot WAV once at the authoritative world center
   * through the existing positional-sound backend. The original roleId0 branch stays silent;
   * EffectMethodN remains an unconsumed source field, so the world-position consumer is chosen
   * because these events have no live actor to attach to.
   */
  worldSound(skillId: number, effectIndex: number, position: readonly [number, number, number]): void {
    const slot = this.backend.skill(skillId)?.effects[effectIndex];
    if (!slot || slot.sound === '' || slot.sound === '0') return;
    this.backend.worldSound?.(slot.sound, position, 1);
  }

  play(message: PlaySkillEffectMessage): void {
    const skill = this.backend.skill(message.skillId);
    if (!skill) return;
    const slot = skill.effects[message.effectIndex];
    if (message.roleId === 0) {
      if (!slot || slot.effectId === 0) return;
      this.backend.world(`_root\\online\\${String(slot.effectId).padStart(3, '0')}`,
        [floatBits(message.xBits), 0, floatBits(message.zBits)], 1);
      return;
    }
    const role = this.backend.role(message.roleId);
    if (role === undefined || !this.backend.hasActor(role) || !slot || slot.effectId === 0) return;
    const record: SkillEffectNotificationRecord<Effect, Sound> = {
      roleId: message.roleId, skillId: message.skillId, effectIndex: message.effectIndex,
      duration: message.duration,
    };
    if (gameContent().skills.get(message.skillId)?.runtime.queuedEffect) {
      let queue = this.roleQueues.get(message.roleId);
      if (!queue) {queue = []; this.roleQueues.set(message.roleId, queue);}
      queue.push(record);
      return;
    }
    const retain = message.duration !== 0 && gameContent().skills.get(message.skillId)?.runtime.retainedEffect;
    if (retain && this.retained.some(existing => existing.roleId === message.roleId &&
      existing.skillId === message.skillId && existing.effectIndex === message.effectIndex)) return;
    const effect = this.backend.attached(role, slot.effectId, 3, slot.tag, !retain);
    const sound = this.backend.sound(role, slot.sound, retain ? -1 : 1, SOUND_OFFSET);
    if (retain) {record.effect = effect; record.sound = sound; this.retained.push(record);}
  }

  stop(message: StopSkillEffectMessage): void {
    for (let index = 0; index < this.retained.length;) {
      const record = this.retained[index];
      if (record.skillId === message.skillId && record.roleId === message.roleId) this.remove(index);
      else ++index;
    }
  }

  /** Original OnPlayerRevival 488f73 starts the first queued record. */
  revive(roleId: number): void {
    const queue = this.roleQueues.get(roleId);
    if (!queue?.length) return;
    this.activate(queue[0]);
    if (queue.length > 1) this.schedule(queue[0]);
  }

  /** Original 488cad stops the current skill and activates its successor. */
  alternate(roleId: number, skillId: number): void {
    const queue = this.roleQueues.get(roleId);
    if (!queue?.length) return;
    const index = queue.findIndex(record => record.skillId === skillId);
    if (index < 0) return;
    this.stopRecord(queue[index]);
    this.timers.delete(roleId);
    const next = queue[(index + 1) % queue.length];
    this.activate(next);
    this.schedule(next);
  }

  /** Original one-shot scheduler 4046a5 receives real elapsed seconds. */
  advanceTimers(deltaSeconds: number): void {
    const delta = Math.fround(deltaSeconds);
    if (delta <= 0) return;
    for (const [roleId, timer] of [...this.timers]) {
      if (timer.remaining < delta) {
        this.timers.delete(roleId);
        this.alternate(roleId, timer.skillId);
      } else timer.remaining = Math.fround(timer.remaining - delta);
    }
  }

  /** Original role removal 488678 clears persistent and queued records. */
  clearRole(roleId: number): void {
    for (let index = 0; index < this.retained.length;) {
      if (this.retained[index].roleId === roleId) this.remove(index);
      else ++index;
    }
    const role = this.backend.role(roleId);
    if (role !== undefined && this.backend.hasActor(role)) this.backend.resetRoleEffects(roleId);
    this.clearQueue(roleId);
  }

  /** Original game-over/destructor 48860e clears all retained records and queues. */
  clear(): void {
    while (this.retained.length) this.remove(0);
    for (const roleId of [...this.roleQueues.keys()].sort((a, b) => a - b)) this.clearQueue(roleId);
  }

  /** Caller supplies 30 Hz simulation steps; reaching 30 decrements duration once. */
  update(argument: number): void {
    this.accumulated = (this.accumulated + argument) | 0;
    if (this.accumulated < 30) return;
    this.accumulated = 0;
    for (let index = 0; index < this.retained.length;) {
      const record = this.retained[index];
      record.duration = (record.duration - 1) | 0;
      if (record.duration === 0) this.remove(index);
      else ++index;
    }
  }

  private remove(index: number): void {
    const record = this.retained[index];
    this.stopRecord(record);
    this.backend.release(record);
    this.retained.splice(index, 1);
  }

  private activate(record: SkillEffectNotificationRecord<Effect, Sound>): void {
    const role = this.backend.role(record.roleId);
    if (role === undefined) return;
    const slot = this.backend.skill(record.skillId)?.effects[record.effectIndex];
    if (!slot) return;
    record.effect = this.backend.attached(role, slot.effectId, 3, slot.tag, false);
    record.sound = this.backend.sound(role, slot.sound, -1, SOUND_OFFSET);
  }

  private schedule(record: SkillEffectNotificationRecord<Effect, Sound>): void {
    this.timers.set(record.roleId, {skillId: record.skillId, remaining: gameContent().skills.get(record.skillId)!.runtime.queueIntervalSeconds});
  }

  clearQueue(roleId: number): void {
    this.timers.delete(roleId);
    const queue = this.roleQueues.get(roleId);
    if (!queue) return;
    for (const record of queue) {
      this.stopRecord(record);
      this.backend.release(record);
    }
    this.roleQueues.delete(roleId);
  }

  private stopRecord(record: SkillEffectNotificationRecord<Effect, Sound>): void {
    this.backend.stopEffect(record.effect!);
    this.backend.stopSound(record.sound!);
  }
}

function floatBits(bits: number): number {
  const data = new DataView(new ArrayBuffer(4));
  data.setUint32(0, bits, true);
  return data.getFloat32(0, true);
}
