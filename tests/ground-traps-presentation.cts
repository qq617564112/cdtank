import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {NullEngine, Scene} from '@babylonjs/core';
import {GroundTrapsPresentation, type GroundTrapPresentationSource} from '../apps/web/src/assets/scenes/ground-traps-presentation';
import type {Trap3003Visual} from '../apps/web/src/assets/scenes/trap3003-visual';

async function main(): Promise<void> {
  const engine = new NullEngine();
  const scene = new Scene(engine);
  const presentation = new GroundTrapsPresentation(scene);
  const created: {id: string; disposed: number; resolve(): void}[] = [];
  const hooks = presentation as unknown as {createVisual(source: GroundTrapPresentationSource): Trap3003Visual};
  hooks.createVisual = source => {
    let resolve!: () => void;
    const loaded = new Promise<void>(r => {resolve = r;});
    const row = {id: source.id, disposed: 0, resolve};
    created.push(row);
    return {load: () => loaded, dispose: () => {row.disposed++;}} as unknown as Trap3003Visual;
  };
  const source: GroundTrapPresentationSource = {id: 'TRAP:1', ownerId: 'P1', team: 0,
    itemTableId: 3003, modelId: 3003, x: 12.5, y: 2, z: -40, expiresAt: 100};
  const first = presentation.reconcile([source], 'room:1');
  const same = presentation.reconcile([source], 'room:1');
  assert.equal(created.length, 1);
  // Removal follows authority presence, independently of local clocks and expiresAt.
  await presentation.reconcile([], 'room:1');
  assert.equal(created[0].disposed, 1);
  created[0].resolve();
  await first; await same;
  const next = presentation.reconcile([source], 'room:2');
  assert.equal(created.length, 2);
  presentation.clear();
  assert.equal(created[1].disposed, 1);
  created[1].resolve(); await next;
  await presentation.reconcile([], 'room:3');
  assert.equal(created.length, 2);
  scene.dispose(); engine.dispose();
  writeFileSync('recovery/output/ground-traps-presentation-module.json', JSON.stringify({
    status: 'PASS_SNAPSHOT_GROUND_CONSUMER_MODULE_ONLY', duplicateLoad: false,
    removedBeforeLoaded: true, roundClear: true, disposalCounts: created.map(row => row.disposed),
    scope: 'Real presence reconciliation with supplied visual loader boundary. Original03003 module is separately verified; no formal World placement, original server policy, player pixels or audio claim.',
  }, null, 2) + '\n');
  console.log('PASS: ground snapshot dedup/removal, pending load and room-round release');
}
void main();
