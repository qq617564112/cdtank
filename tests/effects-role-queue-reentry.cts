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
const effects = [{skill: 13501, effect: 31, root: 2500, nodes: [2500, 2601, 2882], draws: [2601, 2882]},
  {skill: 13502, effect: 32, root: 2755, nodes: [2755, 2828], draws: [2828]}];
for (const effect of effects) {
  const row = original.rows.find(row => row.values.SkillTableID === String(effect.skill))!.values;
  assert.deepEqual([row.Effect1, row.Sound1, row.EffectTag1, row.EffectMethod1], [String(effect.effect), '0', '0', '3']);
  assert.deepEqual(catalog.skills.find(skill => skill.skillId === effect.skill)!.effects[0],
    {effectId: effect.effect, sound: '0', tag: 0, method: 3});
  assert.equal(library.nodes[effect.root].name, `_root\\online\\${String(effect.effect).padStart(3, '0')}`);
  assert.deepEqual(native.rows.find(row => row.node === effect.root && !row.retain)!.created.map(row => row.node), effect.nodes);
  assert.deepEqual(effect.nodes.filter(node => library.nodes[node].type !== 0), effect.draws);
  assert.ok(effect.draws.every(node => library.nodes[node].type === 6));
  assert.equal(library.soundControls.some(control => effect.nodes.includes(control.node)), false);
  for (const node of effect.draws) {
    const grid = library.textureGrids.find(grid => grid.node === node)!;
    assert.equal(grid.resolution, 'published');
    assert.ok(existsSync(`recovery/output/web-assets/${grid.asset}`));
  }
}
writeFileSync('recovery/output/effects-role-queue-reentry.json', `${JSON.stringify({status: 'PASS',
  effects, sourceSound: '0', treeSoundNodes: 0,
  scope: 'Original table/tree/resources; existing native queue rule test and Chromium check cover activation, alternation and cleanup'}, null, 2)}\n`);
console.log('PASS: original silent skill13501/13502 Effect31/32 trees and published resources');
