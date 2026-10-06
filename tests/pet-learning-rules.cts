import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {quotePetSkillLearning, type PetLearningDefinition, type PetLearningPrice} from '../recovery/prepared/pet-learning';
const petTable = JSON.parse(readFileSync('recovery/output/verified/tables/pet.json', 'utf8')) as {
  rows: {values: Record<string, string>}[]};
const priceTable = JSON.parse(readFileSync('recovery/output/verified/tables/petskill.json', 'utf8')) as {
  rows: {values: Record<string, string>}[]};
const raw = petTable.rows.find(row => row.values.ID === '2')!.values;
const definition: PetLearningDefinition = {petId: 2,
  baseIds: Array.from({length: 6}, (_, i) => Number(raw[`Skill${i}`])),
  rankCaps: Array.from({length: 6}, (_, i) => Number(raw[`SkillLv${i}`]))};
const prices = new Map<number, PetLearningPrice>(priceTable.rows.map(({values}) => {
  const skillId = Number(values['技能ID']);
  return [skillId, {skillId, groupId: Number(values['技能类别']), level: Number(values['技能等级']),
    cost: Number(values['花费技能点数'])}];
}));
const native = JSON.parse(readFileSync('recovery/output/pet-skill-learn-request-native.json', 'utf8')) as {
  rows: {name: string; slot: number; rank: number; points: number; mode: number; instance: number;
    sent: {instance: number; slot: number}[]; feedback: number[]}[]};
const rows = [];
for (const original of native.rows.filter(row => row.mode === 2)) {
  const fields = new Map<number, number>([[0, 83], [8, 2]]);
  definition.baseIds.forEach((base, i) => fields.set(0x44 + i * 4, base));
  fields.set(0x5c + original.slot * 4, original.rank);
  const owned = original.instance === 83 ? {name: raw.PetName, fields} : undefined;
  const before = [...fields];
  const quote = quotePetSkillLearning({owned, definition, prices, slot: original.slot, points: original.points});
  assert.equal(quote?.kind === 'eligible', original.sent.length !== 0);
  assert.deepEqual(quote && 'originalFeedback' in quote ? [quote.originalFeedback] : [], original.feedback);
  if (quote?.kind === 'eligible') {
    assert.equal(quote.nextSkillId, 10212); assert.equal(quote.cost, 20);
    assert.equal(quote.nextRank, 2); assert.equal(quote.remainingPoints, 0);
  }
  assert.deepEqual([...fields], before);
  rows.push({name: original.name, quote});
}
const newborn = {name: raw.PetName, fields: new Map<number, number>([[0, 83], [8, 2]])};
definition.baseIds.forEach((id, i) => {newborn.fields.set(0x44 + i * 4, id); newborn.fields.set(0x5c + i * 4, 0);});
const passive = quotePetSkillLearning({owned: newborn, definition, prices, slot: 4, points: 200});
assert(passive?.kind === 'eligible');
assert.equal(passive.nextSkillId, 10251); assert.equal(passive.cost, 200);
assert.equal(passive.nextRank, 1); assert.equal(passive.remainingPoints, 0);
assert.equal(quotePetSkillLearning({owned: newborn, definition, prices, slot: 6, points: 200}), undefined);
newborn.fields.delete(0x6c);
assert.equal(quotePetSkillLearning({owned: newborn, definition, prices, slot: 4, points: 200}), undefined);
writeFileSync('recovery/output/pet-learning-rules.json', JSON.stringify({status: 'PASS_PET_LEARNING_SOURCE_QUALIFICATION_AND_QUOTE_MODULE',
  original: 'pet-skill-learn-request-native.json', rows, newbornPassive: passive,
  boundaries: ['invalid slot rejected', 'missing rank preserved as absent', 'original next-record lookup before cap', 'no input mutation'],
  scope: 'Pure quote against five original sender outcomes plus explicit newborn-rank-zero reconstruction. Account debit/persistence/battle refresh and ordinary multiplayer remain pending.'}, null, 2) + '\n');
console.log('PASS: pet-learning source quote rules');
