import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {EffectBoltSegments} from '../apps/web/src/render/effects/bolts/effect-bolt-segments';
import {EffectRuntimeLibrary, EffectRuntimeTree} from '../apps/web/src/render/effects/runtime/effect-runtime-tree';
interface Operation {
  kind: 'start' | 'tick' | 'stop'; parent: number[]; delta: number;
  phase: number; elapsed: number; controller: number;
  state: EffectBoltSegments & {worldSegments: number[][]; remainder: number};
  randomValues: number[]; events: object[];
}
interface Row {node: number; mode: string; initialParent: number[]; operations: Operation[];}
const native = JSON.parse(readFileSync('recovery/output/effect-sol-bolt-attached-lifecycles-native.json', 'utf8')) as {rows: Row[]};
const library = JSON.parse(readFileSync('recovery/output/web-assets/effect-library.json', 'utf8')) as EffectRuntimeLibrary;
let operationCount = 0;
for (const row of native.rows) {
  const parent = [...row.initialParent];
  let events: object[] = [];
  let randomValues: number[] = [];
  let randomIndex = 0;
  const definition = library.nodes[row.node];
  const tree = new EffectRuntimeTree(library, definition.id, [0, 0, 0], parent, () => {
    assert.ok(randomIndex < randomValues.length, `unexpected rand node${row.node}`);
    return randomValues[randomIndex++];
  }, {play: () => {throw new Error('Unexpected sound');}, finished: () => true, stop: () => {}}, {},
  () => events.push({kind: 'release'}));
  const bolt = tree.root.bolt!;
  for (const [index, operation] of row.operations.entries()) {
    parent.splice(0, parent.length, ...operation.parent);
    randomValues = operation.randomValues;
    randomIndex = 0;
    events = [];
    if (operation.kind === 'start') tree.start();
    else if (operation.kind === 'stop') tree.stop();
    else tree.update(operation.delta);
    const label = `node${row.node} ${row.mode} op${index} ${operation.kind}`;
    assert.equal(tree.root.lifecycle.phase, operation.phase, label);
    assert.equal(tree.root.lifecycle.elapsed, operation.elapsed, label);
    assert.equal(tree.root.lifecycle.controller, operation.controller, label);
    assert.deepEqual({...bolt.bolt, worldSegments: bolt.worldSegments, remainder: bolt.remainder}, operation.state, label);
    assert.deepEqual(events, operation.events, label);
    assert.equal(randomIndex, randomValues.length, label);
    ++operationCount;
  }
}
console.log(`PASS: ${native.rows.length} production source attached sequences / ${operationCount} original start/tick/stop operations`);
