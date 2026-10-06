import assert from 'node:assert/strict';
import {existsSync, readFileSync, writeFileSync} from 'node:fs';

type Effect = {effectId: number; sound: string; tag: number; method: number};
type Catalog = {
  items: {itemTableId: number; skillIds: number[]}[];
  skills: {skillId: number; effects: Effect[]}[];
};
type Library = {
  nodes: {type: number}[];
  textureGrids: {node: number; resolution: string; asset: string}[];
};
type Native = {rows: {node: number; retain: boolean; created: {node: number; retain: boolean}[]}[]};

const read = <T,>(path: string): T => JSON.parse(readFileSync(path, 'utf8')) as T;
const catalog = read<Catalog>('recovery/output/web-assets/combat-catalog.json');
const library = read<Library>('recovery/output/web-assets/effect-library.json');
const native = read<Native>('recovery/output/effect-tree-create-native.json');
const healing = read<{
  item: number;
  skill: number;
  effect: number;
  sound: string;
  tag: string;
  method: number;
  sourceNodes: {node: number; retain: boolean}[];
  renderedNodes: number[];
  liveAttachment: boolean;
  naturalExpiry: boolean;
  explicitStop: boolean;
  detach: boolean;
  runtimeStop: boolean;
}>('recovery/output/healing-effect-fidelity.json');
const effect: Effect = {effectId: 11, sound: 'GA15', tag: 0, method: 3};
for (const [itemTableId, skillId] of [[1, 1], [2, 2]] as const) {
  const item = catalog.items.find(row => row.itemTableId === itemTableId);
  assert.ok(item, `catalog item ${itemTableId}`);
  assert.equal(item.skillIds[0], skillId);
  assert.deepEqual(catalog.skills.find(row => row.skillId === skillId)?.effects[0], effect);
}

const root = native.rows.find(row => row.node === 2637 && !row.retain);
assert.ok(root);
const sourceNodes = root.created;
assert.deepEqual(sourceNodes.map(row => row.node), [2637, 2643, 2663, 2664, 2665, 2666, 2667, 2830, 2834]);
const drawnNodes = [2664, 2665, 2667, 2830, 2834];
assert.deepEqual(sourceNodes.filter(row => library.nodes[row.node].type !== 0).map(row => row.node), drawnNodes);
assert.deepEqual(drawnNodes.map(node => library.nodes[node].type), [1, 1, 1, 6, 6]);
const grids = library.textureGrids.filter(grid => drawnNodes.includes(grid.node));
assert.equal(grids.length, drawnNodes.length);
assert.ok(grids.every(grid => grid.resolution === 'published' && grid.asset));
for (const grid of grids) assert.ok(existsSync(`recovery/output/web-assets/${grid.asset}`), grid.asset);
assert.equal(healing.item, 1);
assert.equal(healing.skill, 1);
assert.equal(healing.effect, 11);
assert.equal(healing.sound, 'GA15');
assert.equal(healing.tag, 'tag_efcenter');
assert.equal(healing.method, 3);
assert.deepEqual(healing.sourceNodes, sourceNodes);
assert.deepEqual(healing.renderedNodes, drawnNodes);
for (const boundary of ['liveAttachment', 'naturalExpiry', 'explicitStop', 'detach', 'runtimeStop'] as const) {
  assert.equal(healing[boundary], true, boundary);
}

const ga15 = 'recovery/output/web-assets/audio/sound/GA15.wav';
assert.ok(existsSync(ga15), ga15);
const evidence = {
  status: 'PASS',
  scope: 'Existing evidence consistency check for healing Effect11/GA15; not new device presentation acceptance',
  items: [1, 2],
  skills: [1, 2],
  effect,
  rootNode: 2637,
  sourceNodes: sourceNodes.map(row => row.node),
  drawnNodes,
  drawnTypes: drawnNodes.map(node => library.nodes[node].type),
  textureAssets: grids.map(grid => grid.asset),
  attachmentTag: 'tag_efcenter',
  audioAsset: ga15,
  lifecycle: {
    liveAttachment: true,
    naturalExpiry: true,
    explicitStop: true,
    detach: true,
    runtimeStop: true,
  },

};
writeFileSync('recovery/output/effects-fidelity-m1.json', `${JSON.stringify(evidence, null, 2)}\n`);
console.log('PASS: Effect11/GA15 catalog, native tree, published textures, tag_efcenter attachment, and lifecycle boundaries');
