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
const sourceSkill = original.rows.find(row => row.values.SkillTableID === '13')!.values;
assert.deepEqual([sourceSkill.Effect1,sourceSkill.Sound1,sourceSkill.EffectTag1,sourceSkill.EffectMethod1],['10','SE02','0','3']);
assert.deepEqual(catalog.skills.find(skill=>skill.skillId===13)!.effects[0],{effectId:10,sound:'SE02',tag:0,method:3});
const tree=native.rows.find(row=>row.node===2462&&!row.retain)!.created.map(row=>row.node);
assert.deepEqual(tree,[2462,2463,2464,2465,2466,2467,2468,2558,2559,2560]);
const draws=tree.filter(node=>library.nodes[node].type!==0);
assert.deepEqual(draws,[2463,2464,2465,2466,2467,2468,2559,2560]);
assert.equal(library.soundControls.some(control=>tree.includes(control.node)),false);
for(const node of draws){const grid=library.textureGrids.find(grid=>grid.node===node)!;assert.equal(grid.resolution,'published');assert.ok(existsSync(`recovery/output/web-assets/${grid.asset}`));}
writeFileSync('recovery/output/effects-skill13-world.json',`${JSON.stringify({status:'PASS',skill:13,effect:10,catalogSound:'SE02',worldHandlerSound:'none',sourceNodes:tree,drawNodes:draws,
  scope:'Original source table/tree/resources; role0 notification world dispatch and silent branch follow existing native message contract'},null,2)}\n`);
console.log('PASS: Skill13 Effect10 original world tree, eight published draw resources and no tree audio');
