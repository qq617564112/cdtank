import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {combatItems, combatItemSkills, combatSkills} from '../apps/server/src/battle/catalog';
import {isPassiveRoleSkill, selectRoleItemSkills} from '../apps/server/src/battle/roles/skills';

const item = combatItems.get(17061);
const skill = combatSkills.get(13171);
assert(item, '17061 must remain present in the published catalog');
assert(skill, '13171 must remain present in the published catalog');
assert.equal(item.skillIds[0], 13171);
assert.equal(item.itemType, 12);
assert.equal(item.moneyPrice, 1500);
assert.equal(item.tokenPrice, 150);
assert.equal(item.info, '装备后每3秒回复50点生命值。');
assert.equal(skill.info, '装备后每3秒回复20点生命值。');
assert.equal(skill.triggerType, 0);
assert.equal(skill.target, 1);
assert.equal(skill.attributes.HP, 20);
assert.equal(skill.functions[0].type, 2);
assert.equal(skill.functions[0].t, 999);
assert.equal(skill.functions[0].x, 3);
assert.equal(isPassiveRoleSkill(skill), false,
  'Func2/T999 must not be treated as an attribute passive');

const expanded = selectRoleItemSkills([17061], [], combatSkills, combatItemSkills);
assert.equal(expanded.some(candidate => candidate.skillId === 13171), false,
  'the unresolved periodic consumer must not enter currentSkills');

const evidence = {
  status: 'PASS_SOURCE_GATE_WITH_CONSUMER_GAP',
  item: {itemTableId: item.itemTableId, itemType: item.itemType, skillIds: item.skillIds,
    moneyPrice: item.moneyPrice, tokenPrice: item.tokenPrice, info: item.info},
  skill: {skillId: skill.skillId, triggerType: skill.triggerType, target: skill.target,
    attributes: {HP: skill.attributes.HP}, function0: skill.functions[0], info: skill.info},
  passiveSelection: {isPassiveRoleSkill: false, expandedSkillIds: expanded.map(candidate => candidate.skillId)},
  unresolved: ['Func2 dispatcher', 'T999 semantics', 'X3 period/time-base mapping', 'HP increment target producer'],
  scope: 'Source gate only; no periodic recovery, account inventory, World or network claim.'
};
writeFileSync('recovery/output/supply-part-consumer-gap.json', JSON.stringify(evidence, null, 2) + '\n');
console.log(JSON.stringify(evidence));
