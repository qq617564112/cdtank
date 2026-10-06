import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {EffectRuntimeTree, type EffectRuntimeLibrary} from '../apps/web/src/render/effects/runtime/effect-runtime-tree';
import {EffectSoundNodeState} from '../apps/web/src/render/effects/runtime/effect-sound-node';
import {observeEffectSoundNodes} from './helpers/effect-sound-node-observer.mjs';

const library: EffectRuntimeLibrary = {
  nodes: [
    {index: 100, id: 100, type: 0, name: 'root', children: [101, 102]},
    {index: 101, id: 101, type: 4, name: 'early', children: []},
    {index: 102, id: 102, type: 4, name: 'late', children: []},
  ],
  nodeTimings: [
    {node: 100, delay: 0, lifetime: 0, controllers: []},
    {node: 101, delay: .4, lifetime: 0, controllers: []},
    {node: 102, delay: 1.2, lifetime: 0, controllers: []},
  ],
  soundControls: [101, 102].map(node => ({node, reference: 'ww053', parameter: 0, stopPrevious: false})),
  spriteControls: [], particleControls: [], stripControls: [], textureGrids: [],
  boltControls: [], boltTextures: [], overlayControls: [], screenControls: [], modelControls: [],
};
let nextVoice = 0;
const backend = {play: () => ++nextVoice, finished: () => true, stop() {}};
const first = {handle: 11, result: 'scene-result', tree: new EffectRuntimeTree(library, 100,
  [0, 0, 0], undefined, () => 0, backend, {})};
const second = {handle: 22, result: 'other-shot', tree: new EffectRuntimeTree(library, 100,
  [0, 0, 0], undefined, () => 0, backend, {})};
const records: {reference: string; voice: number; instance?: number; node?: number; result?: string}[] = [];
const restore = observeEffectSoundNodes(EffectSoundNodeState, backend, () => [first, second],
  (call: {reference: string; voiceHandle: number; instance?: typeof first; node?: {definition: {index: number}}}) => {
    records.push({reference: call.reference, voice: call.voiceHandle, instance: call.instance?.handle,
      node: call.node?.definition.index, result: call.instance?.result});
  });
try {
  first.tree.start();
  first.tree.update(.1);
  first.tree.update(.4);
  second.tree.start();
  second.tree.update(.1);
  second.tree.update(.4);
  first.tree.update(.8);
  second.tree.update(.8);
  assert.deepEqual(records.map(row => [row.instance, row.node, row.result]), [
    [11, 101, 'scene-result'], [22, 101, 'other-shot'],
    [11, 102, 'scene-result'], [22, 102, 'other-shot'],
  ]);
  for (const row of records) {
    const owner = row.instance === 11 ? first : second;
    assert.equal(owner.tree.nodes.find(node => node.definition.index === row.node)?.sound?.handle, row.voice);
  }
  backend.play();
  assert.equal(records.at(-1)?.instance, undefined);
  assert.equal(records.at(-1)?.node, undefined);
  assert.equal(records.at(-1)?.result, undefined);
} finally {
  restore();
  first.tree.dispose();
  second.tree.dispose();
}
writeFileSync('recovery/output/effect-sound-node-observer-composition.json', JSON.stringify({
  status: 'PASS_OBSERVER_COMPOSITION_ONLY',
  fixture: 'Two actual EffectRuntimeTree instances with synthetic same-reference type4 nodes and delayed interleaved updates',
  records,
  scope: 'Actual node.sound object identity associates play return voice handle to its instance/node; outside-node play stays unowned. No browser/audio/pixel/2014 Leave acceptance.',
}, null, 2) + '\n');
console.log('PASS: delayed interleaved sound nodes retain exact instance ownership');
