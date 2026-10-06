import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {EffectTargetProvider} from '../apps/web/src/render/effects/runtime/effect-target-provider';
import {EffectRuntimeLibrary, EffectRuntimeTree} from '../apps/web/src/render/effects/runtime/effect-runtime-tree';
import {EffectBoltSegments} from '../apps/web/src/render/effects/bolts/effect-bolt-segments';
import {EffectVec3} from '../apps/web/src/render/effects/common/types';
interface Operation {
  kind: 'bind' | 'move' | 'invalidate' | 'draw'; target: 'a' | 'b' | null;
  bound: 'a' | 'b' | null; observersA: number; observersB: number;
  positionCalls: string[]; randomValues: number[];
  state: EffectBoltSegments & {worldSegments: number[][]};
}
interface Row {node: number; parent?: number[]; origin: EffectVec3; operations: Operation[];}
const native = JSON.parse(readFileSync('recovery/output/effect-sol-provider-target-native.json', 'utf8')) as {rows: Row[]};
const library = JSON.parse(readFileSync('recovery/output/web-assets/effect-library.json', 'utf8')) as EffectRuntimeLibrary;
let operations = 0;
for (const row of native.rows) {
  let values: number[] = [];
  let randomIndex = 0;
  let positionCalls: string[] = [];
  const positions: Record<'a' | 'b', EffectVec3> = {a: [15,-2,31], b: [15,-2,31]};
  const make = (name: 'a' | 'b'): EffectTargetProvider => new EffectTargetProvider(() => {
    positionCalls.push(name);
    return positions[name];
  });
  const targets = {a: make('a'), b: make('b')};
  const definition = library.nodes[row.node];
  const tree = new EffectRuntimeTree(library, definition.id, row.origin, row.parent ?? undefined, () => {
    assert.ok(randomIndex < values.length);
    return values[randomIndex++];
  }, {play: () => {throw new Error('Unexpected sound');}, finished: () => true, stop: () => {}}, {});
  const bolt = tree.root.bolt!;
  for (const [index, operation] of row.operations.entries()) {
    values = operation.randomValues;
    randomIndex = 0;
    positionCalls = [];
    const name = operation.target;
    if (operation.kind === 'bind') bolt.target.bind(name ? targets[name] : undefined);
    else if (operation.kind === 'move') positions[name!] = [-6,12,44];
    else if (operation.kind === 'invalidate') targets[name!].invalidate();
    else bolt.start(row.origin);
    const label = `node${row.node} op${index} ${operation.kind}`;
    assert.equal(bolt.target.target, operation.bound ? targets[operation.bound] : undefined, label);
    assert.equal(targets.a.observerCount, operation.observersA, label);
    assert.equal(targets.b.observerCount, operation.observersB, label);
    assert.deepEqual(positionCalls, operation.positionCalls, label);
    assert.equal(randomIndex, values.length, label);
    assert.deepEqual({...bolt.bolt, worldSegments: bolt.worldSegments}, operation.state, label);
    if (operation.kind === 'invalidate') {
      positions[name!] = [15,-2,31];
      targets[name!] = make(name!);
    }
    ++operations;
  }
  bolt.target.bind(targets.a);
  tree.dispose();
  assert.equal(targets.a.observerCount, 0, 'Production tree disposal detaches target');
}
// Constructor integration passes the provider through every real type2 child.
const target = new EffectTargetProvider(() => [15,-2,31]);
const root = library.nodes[130];
const tree = new EffectRuntimeTree(library, root.id, [0,0,0], undefined, () => 8191,
  {play: () => {throw new Error('Unexpected sound');}, finished: () => true, stop: () => {}}, {},
  undefined, undefined, undefined, undefined, undefined, target);
assert.equal(target.observerCount, 3);
tree.start();
tree.update(0);
for (const node of tree.nodes.filter(entry => entry.bolt)) assert.deepEqual(node.bolt!.bolt.end, [15,-2,31]);
target.invalidate();
assert.equal(target.observerCount, 0);
for (const node of tree.nodes.filter(entry => entry.bolt)) assert.equal(node.bolt!.target.target, undefined);
tree.dispose();
console.log(`PASS: ${native.rows.length} original provider sequences / ${operations} operations; production three-child binding/invalidation/disposal`);
