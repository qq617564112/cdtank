import {content} from '../content';
import {combatCatalog, combatSkills} from './catalog';
import type {CombatSkillDefinition} from '../../../shared/combat/catalog';
import type {OwnedRoleBaseRecord} from '../../../shared/contracts/owned-base';
import type {BattleRoleSources} from '../battle-role-sources';

export type PetSkillEvent = 'passive' | 'motion' | 'health' | 'hit' | 'kill' |
  'death' | 'respawn' | 'tick' | 'shot' | 'lethal';
export type PetSkillHandler = 'attributes' | 'heal' | 'copy' | 'backCritical' | 'lastStand';

export interface PetSkillRule {
  baseId: number;
  event: PetSkillEvent;
  handler: PetSkillHandler;
  target: 'self' | 'teammates' | 'team';
  condition?: 'moving' | 'stationary' | 'lowHealth';
}

export interface LearnedPetSkill {
  baseId: number;
  rank: number;
  skill: CombatSkillDefinition;
  rule: PetSkillRule;
}

export interface PetSkillSource {
  ownedRoles?: Pick<BattleRoleSources, 'snapshot'>;
  boundGear?: OwnedRoleBaseRecord;
  combat?: {record?: {numericFields?: ReadonlyMap<number, number>}};
}

function resolveLearnedSkill(petId: number, baseId: number, rank: number):
    LearnedPetSkill | undefined {
  const definition = content.pets.get(petId)?.skills.find(skill => skill.baseId === baseId);
  if (!definition || !Number.isInteger(rank) || rank < 1 || rank > definition.rankCap
      || !definition.event || !definition.handler) return;
  const skill = combatSkills.get(definition.levels[rank - 1]);
  const rule = definition as PetSkillRule;
  if (skill) return {baseId, rank, rule, skill};
}

/** Frozen selected skills and the single life-local copied source share the same routing. */
export function readPetSkills(player: PetSkillSource, includeCopied = true): LearnedPetSkill[] {
  const fields = (player.boundGear ?? player.ownedRoles?.snapshot().base)?.fields;
  const selected: LearnedPetSkill[] = [];
  if (fields) {
    const petId = fields.get(8)!;
    for (let slot = 0; slot < 6; slot++) {
      const learned = resolveLearnedSkill(petId, fields.get(0x44 + slot * 4)!,
        fields.get(0x5c + slot * 4)!);
      if (learned) selected.push(learned);
    }
  }
  if (includeCopied) {
    const extra = player.combat?.record?.numericFields;
    const baseId = extra?.get(0x88), rank = extra?.get(0x8c);
    const owner = combatCatalog.petTypes?.find(pet => pet.baseIds?.includes(baseId!));
    const learned = owner && baseId !== undefined && rank !== undefined
      ? resolveLearnedSkill(owner.petId, baseId, rank) : undefined;
    if (learned) {
      const index = selected.findIndex(source => source.baseId === learned.baseId);
      if (index === -1) selected.push(learned);
      else if (learned.rank > selected[index].rank) selected[index] = learned;
    }
  }
  return selected;
}

export function findPetSkill(player: PetSkillSource, handler: PetSkillHandler):
    LearnedPetSkill | undefined {
  return readPetSkills(player).find(source => source.rule.handler === handler);
}
