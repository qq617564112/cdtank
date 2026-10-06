import assert from 'node:assert/strict';
import {existsSync, readFileSync, writeFileSync} from 'node:fs';
import type {CombatCatalog} from '../apps/shared/combat/catalog';

const catalog = JSON.parse(readFileSync('recovery/output/web-assets/combat-catalog.json', 'utf8')) as CombatCatalog;
const original = JSON.parse(readFileSync('recovery/output/verified/tables/skill.json', 'utf8')) as {
  rows: {values: Record<string, string>}[];
};
const library = JSON.parse(readFileSync('recovery/output/web-assets/effect-library.json', 'utf8')) as {
  nodes: {name: string; type: number}[];
  textureGrids: {node: number; asset: string; resolution: string}[];
  soundControls: {node: number; reference: string}[];
};
const native = JSON.parse(readFileSync('recovery/output/effect-tree-create-native.json', 'utf8')) as {
  rows: {node: number; retain: boolean; created: {node: number}[]}[];
};
const sourceSkill = original.rows.find(row => row.values.SkillTableID === '12')!.values;
assert.deepEqual([sourceSkill.Effect1, sourceSkill.Sound1, sourceSkill.EffectTag1, sourceSkill.EffectMethod1], ['19', 'GA35', '0', '3']);
assert.deepEqual(catalog.skills.find(skill => skill.skillId === 12)!.effects[0], {effectId: 19, sound: 'GA35', tag: 0, method: 3});
const tree = native.rows.find(row => row.node === 2469 && !row.retain)!.created.map(row => row.node);
assert.deepEqual(tree, [2469,2470,2827,2484,2486,2487,2488,2489,2490,2491,2492]);
assert.deepEqual(tree.filter(node => library.nodes[node].type === 5), [2470,2827]);
const models = JSON.parse(readFileSync('recovery/output/web-assets/effect-models.json', 'utf8')) as {
  resources: {reference: string; resolution: string; nodes: {parts: {asset: string | null}[]}[]}[];
};
const resource = models.resources.find(resource => resource.reference === 'data\\effect\\effect\\online\\00012.cvd')!;
assert.equal(resource.resolution, 'published');
for (const node of resource.nodes) for (const part of node.parts) assert.ok(part.asset && existsSync(`recovery/output/web-assets/${part.asset}`));
assert.ok(existsSync('recovery/output/web-assets/audio/sound/GA35.wav'));
writeFileSync('recovery/output/effects-skill12-model.json', `${JSON.stringify({status:'PASS', skill:12,effect:19,sound:'GA35',tag:'tag_efcenter',method:3,
  sourceNodes:tree,modelNodes:[2470,2827],model:resource.reference,texture:resource.nodes[0].parts[0].asset,
  scope:'Original skill and native tree plus published model/texture/audio; Chromium validates actual consumer/model/audio lifecycle'},null,2)}\n`);
console.log('PASS: Skill12 Effect19/GA35 original tree and two published type5 model references');
