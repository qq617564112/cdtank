import {combatSkills} from './catalog';
import {recomputeBattleAttributes} from './attributes';
import {setBattleHealth} from './health';
import {clearCopiedRoleSkill, copyPassiveSkillAfterKill} from './passive-skill-copy';
import {readPetSkills, type LearnedPetSkill, type PetSkillEvent,
  type PetSkillHandler} from './pet-skill-rules';
import {recordHealing} from './round-statistics';
import type {PlayerState} from './player-state';
import type {CombatSkillDefinition} from '../../../shared/combat/catalog';
import type {MsgRoomEvent} from '../../../shared/protocols';

interface PetBattleRoom {
  roomId: string;
  mode: number;
  players: ReadonlyMap<string, PlayerState>;
}

interface PetSkillInvocation {
  source: LearnedPetSkill;
  target: PlayerState;
  now: number;
  events: MsgRoomEvent[];
  victim?: PlayerState;
}

type EventHandler = (invocation: PetSkillInvocation) => void;

const COMMAND_SKILL_ID = 10541;

/** Per-player lifecycle hooks dispatch the handlers named by the selected pet's JSON. */
export class PetBattleSkills {
  private readonly timed = new Map<number, {skillId: number; expiresAt: number}>();
  private conditional = new Set<number>();
  private teamSkills = new Set<number>();
  private readonly regeneration = new Map<number, number>();
  private commandEffect?: {skillId: number; casterId: string};
  private position: {x: number; y: number; z: number};
  private moving = false;
  private active = true;

  private readonly handlers: Partial<Record<PetSkillHandler, EventHandler>> = {
    attributes: ({source, target, now, events}) => {
      if (target.petBattle?.receiveAttributeSkill(source, now)) {
        pushPetTrigger(events, this.room, this.player, target, source.skill);
      }
    },
    heal: ({source, target, events}) => this.heal(target, source, events),
    copy: ({source, target, victim, events}) => {
      if (victim && copyPassiveSkillAfterKill(target, victim, this.room.mode)) {
        target.petBattle?.copiedSkillChanged();
        refreshPetTeamSkills(this.room);
        pushPetTrigger(events, this.room, this.player, target, source.skill);
      }
    },
  };

  constructor(private readonly player: PlayerState, private readonly room: PetBattleRoom) {
    this.position = {x: player.x, y: player.y, z: player.z};
  }

  attributeSkillIds(): number[] {
    return [...new Set([...this.conditional, ...this.teamSkills,
      ...[...this.timed.values()].map(state => state.skillId)])];
  }

  start(): void {
    this.recompute();
    this.refreshConditions();
  }

  healthChanged(): void {
    if (this.active) this.refreshConditions();
  }

  hit(attacker: Pick<PlayerState, 'id' | 'team'>, hpBefore: number, now: number,
      events: MsgRoomEvent[]): void {
    if (!this.live() || this.player.hp <= 0 || this.player.hp >= hpBefore ||
        this.player.id === attacker.id ||
        (this.room.mode <= 3 && this.player.team === attacker.team)) return;
    this.dispatch('hit', now, events);
  }

  kill(victim: PlayerState, now: number, events: MsgRoomEvent[]): void {
    if (!this.live() || victim.alive || victim.id === this.player.id ||
        (this.room.mode <= 3 && victim.team === this.player.team)) return;
    // Capture the source set before a copy replaces it; the new skill starts with the next event.
    this.dispatch('kill', now, events, victim);
  }

  death(now: number, events: MsgRoomEvent[]): void {
    if (!this.active) return;
    this.dispatch('death', now, events);
    this.clear();
  }

  respawn(now: number, events: MsgRoomEvent[]): void {
    this.active = true;
    this.moving = false;
    this.position = {x: this.player.x, y: this.player.y, z: this.player.z};
    this.refreshConditions();
    this.dispatch('respawn', now, events);
  }

  advance(now: number): void {
    if (!this.active) return;
    let changed = false;
    for (const [baseId, state] of this.timed) {
      if (now >= state.expiresAt) {this.timed.delete(baseId); changed = true;}
    }
    if (changed) this.recompute();
    this.refreshConditions();
  }

  /** Sample accepted poses for human, CPU and autopilot after the actor's movement step. */
  motion(now: number, events: MsgRoomEvent[]): void {
    if (!this.live()) return;
    const moving = this.position.x !== this.player.x || this.position.y !== this.player.y ||
      this.position.z !== this.player.z;
    this.position = {x: this.player.x, y: this.player.y, z: this.player.z};
    this.moving = moving;
    this.refreshConditions();
    for (const source of readPetSkills(this.player).filter(source => source.rule.event === 'tick')) {
      const fn = source.skill.functions.find(fn => fn.type === 2);
      if (!this.conditionMatches(source) || !fn || fn.x <= 0) {
        this.regeneration.delete(source.skill.skillId);
        continue;
      }
      const next = this.regeneration.get(source.skill.skillId);
      if (next === undefined) {
        this.regeneration.set(source.skill.skillId, now + fn.x * 1000);
      } else if (now >= next) {
        this.regeneration.set(source.skill.skillId, now + fn.x * 1000);
        this.invoke(source, now, events);
      }
    }
  }

  refreshTeamSkills(): void {
    const next = new Set<number>();
    if (this.live() && this.room.mode <= 3) {
      const own = new Set(readPetSkills(this.player).map(source => source.skill.skillId));
      for (const sourcePlayer of this.room.players.values()) {
        if (!sourcePlayer.alive || sourcePlayer.combat.status !== 2 ||
            !sourcePlayer.attributesReady || sourcePlayer.team !== this.player.team) continue;
        for (const source of readPetSkills(sourcePlayer)) {
          if (source.rule.event === 'passive' && source.rule.target === 'team' &&
              !own.has(source.skill.skillId)) next.add(source.skill.skillId);
        }
      }
    }
    if (!sameSkills(this.teamSkills, next)) {
      this.teamSkills = next;
      this.recompute();
    }
  }

  reconcileCommandEffects(events: MsgRoomEvent[]): void {
    if (!this.live() || this.player.hp <= 0) {
      this.commandEffect = undefined;
      return;
    }
    const source = this.commandEffectSource();
    if (!source) {
      const previous = this.commandEffect;
      this.commandEffect = undefined;
      if (previous) {
        const skill = combatSkills.get(previous.skillId);
        if (skill) {
          pushPetTriggerEffect(events, this.room, previous.casterId, this.player, skill, 1);
        }
      }
      return;
    }
    if (!this.commandEffect) {
      this.commandEffect = {skillId: source.skill.skillId, casterId: source.caster.id};
      pushPetTriggerEffect(events, this.room, source.caster.id, this.player, source.skill, 0);
      return;
    }
    this.commandEffect.skillId = source.skill.skillId;
    this.commandEffect.casterId = source.caster.id;
  }

  /** Death, leave and round end withdraw this player's temporary sources together. */
  clear(forceRecompute = false): void {
    this.active = false;
    this.commandEffect = undefined;
    const changed = this.attributeSkillIds().length > 0;
    this.timed.clear();
    this.conditional.clear();
    this.teamSkills.clear();
    this.regeneration.clear();
    if (changed || forceRecompute) this.recompute();
  }

  private live(): boolean {
    return this.active && this.player.alive && this.player.combat.status === 2 &&
      this.player.attributesReady;
  }

  private commandEffectSource(): {skill: CombatSkillDefinition; caster: PlayerState} | undefined {
    const own = readPetSkills(this.player).find(isCommandEffectSource);
    if (own) return {skill: own.skill, caster: this.player};
    if (this.room.mode > 3) return;
    for (const caster of this.room.players.values()) {
      if (caster.id === this.player.id || !caster.alive || caster.combat.status !== 2 ||
          !caster.attributesReady || caster.team !== this.player.team) continue;
      const source = readPetSkills(caster).find(isCommandEffectSource);
      if (source) return {skill: source.skill, caster};
    }
  }

  private conditionMatches(source: LearnedPetSkill): boolean {
    switch (source.rule.condition) {
      case 'moving': return this.moving;
      case 'stationary': return !this.moving;
      case 'lowHealth': {
        const threshold = source.skill.functions.find(fn => fn.type === 1)?.z ?? 0;
        return this.player.hp * 100 < this.player.attributes.record.maxHp * threshold;
      }
      default: return true;
    }
  }

  private refreshConditions(): void {
    const next = new Set<number>();
    if (this.live()) {
      for (const source of readPetSkills(this.player)) {
        if (source.rule.handler === 'attributes' &&
            (source.rule.event === 'motion' || source.rule.event === 'health') &&
            this.conditionMatches(source)) next.add(source.skill.skillId);
      }
    }
    if (!sameSkills(this.conditional, next)) {
      this.conditional = next;
      this.recompute();
    }
  }

  private dispatch(event: PetSkillEvent, now: number, events: MsgRoomEvent[], victim?: PlayerState): void {
    const sources = readPetSkills(this.player).filter(source => source.rule.event === event);
    sources.sort((left, right) => Number(left.rule.handler === 'copy') - Number(right.rule.handler === 'copy'));
    for (const source of sources) this.invoke(source, now, events, victim);
  }

  private invoke(source: LearnedPetSkill, now: number, events: MsgRoomEvent[], victim?: PlayerState): void {
    const handler = this.handlers[source.rule.handler];
    if (!handler || !this.conditionMatches(source)) return;
    for (const target of this.recipients(source)) handler({source, target, now, events, victim});
  }

  private recipients(source: LearnedPetSkill): PlayerState[] {
    if (source.rule.target === 'self') return [this.player];
    if (this.room.mode > 3) return [];
    return [...this.room.players.values()].filter(target => target.alive &&
      target.combat.status === 2 && target.team === this.player.team &&
      (source.rule.target === 'team' || target.id !== this.player.id));
  }

  /** Installs or refreshes the timed attribute source; returns whether the target accepted it. */
  private receiveAttributeSkill(source: LearnedPetSkill, now: number): boolean {
    if (!this.live() || this.player.hp <= 0) return false;
    const fn = source.skill.functions.find(fn => fn.type === 1);
    if (!fn || fn.t <= 0 || fn.t === 0xffff) return false;
    const current = this.timed.get(source.baseId);
    // Equal ranks refresh; a stronger concurrent rank replaces the same family's effect.
    if (current && current.skillId > source.skill.skillId && now < current.expiresAt) return false;
    this.timed.set(source.baseId, {skillId: source.skill.skillId, expiresAt: now + fn.t * 1000});
    if (current?.skillId !== source.skill.skillId) this.recompute();
    return true;
  }

  private heal(target: PlayerState, source: LearnedPetSkill, events: MsgRoomEvent[]): void {
    if (!target.alive || target.hp <= 0 || target.combat.status !== 2 ||
        !target.attributesReady || source.skill.attributes.HP <= 0) return;
    const previous = target.hp;
    setBattleHealth(target, previous + source.skill.attributes.HP);
    const restored = target.hp - previous;
    if (restored <= 0) return;
    if (target.id !== this.player.id && this.room.mode <= 3 &&
        target.team === this.player.team) recordHealing(this.player, restored);
    const effect = source.skill.effects[0];
    events.push({roomId: this.room.roomId, type: 'playerHealed',
      message: `${target.name}恢复${restored}生命`, playerId: this.player.id, targetId: target.id,
      value: restored, x: target.x, y: target.y, z: target.z, skillId: source.skill.skillId,
      playSkillEffect: effect && effect.effectId !== 0
        ? {skillId: source.skill.skillId, effectIndex: 0, duration: 0,
          roleId: Number(target.id.slice(1)), xBits: 0, zBits: 0} : undefined});
  }

  private copiedSkillChanged(): void {
    this.regeneration.clear();
    // A replaced copied trigger cannot leave its attribute effect installed.
    const sources = new Map(readPetSkills(this.player).map(source => [source.baseId, source.skill.skillId]));
    for (const [baseId, state] of this.timed) {
      const skill = combatSkills.get(state.skillId);
      if (skill?.target === 1 && sources.get(baseId) !== state.skillId) this.timed.delete(baseId);
    }
    this.recompute();
    this.refreshConditions();
  }

  private recompute(): void {
    this.player.combat.dirty = true;
    recomputeBattleAttributes(this.player);
    if (this.player.hp > this.player.attributes.record.maxHp) {
      setBattleHealth(this.player, this.player.attributes.record.maxHp);
    }
  }
}

function sameSkills(previous: ReadonlySet<number>, next: ReadonlySet<number>): boolean {
  return previous.size === next.size && [...previous].every(id => next.has(id));
}

function isCommandEffectSource(source: LearnedPetSkill): boolean {
  return source.skill.skillId === COMMAND_SKILL_ID && source.rule.event === 'passive' &&
    source.rule.target === 'team';
}

/** Emits the beneficiary's first-slot source trigger; a zero first-slot effect stays silent. */
function pushPetTrigger(events: MsgRoomEvent[], room: PetBattleRoom, caster: PlayerState,
  target: PlayerState, skill: CombatSkillDefinition): void {
  pushPetTriggerEffect(events, room, caster.id, target, skill, 0);
}

/** Emits one source trigger slot for the beneficiary; a zero effect slot stays silent. */
function pushPetTriggerEffect(events: MsgRoomEvent[], room: PetBattleRoom, casterId: string,
  target: PlayerState, skill: CombatSkillDefinition, effectIndex: number): void {
  if ((skill.effects[effectIndex]?.effectId ?? 0) === 0) return;
  events.push({
    roomId: room.roomId, type: 'petSkillTriggered', message: `${target.name}触发${skill.name}`,
    playerId: casterId, targetId: target.id, value: 0,
    x: target.x, y: target.y, z: target.z, skillId: skill.skillId,
    playSkillEffect: {skillId: skill.skillId, effectIndex, duration: 0,
      roleId: Number(target.id.slice(1)), xBits: 0, zBits: 0},
  });
}

export function refreshPetTeamSkills(room: PetBattleRoom): void {
  for (const player of room.players.values()) player.petBattle?.refreshTeamSkills();
}

export function detachPetBattle(player: Pick<PlayerState, 'petBattle' | 'combat'>): void {
  const hooks = player.petBattle;
  delete player.petBattle;
  const copied = clearCopiedRoleSkill(player.combat);
  hooks?.clear(copied);
}
