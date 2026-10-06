import assert from 'node:assert/strict';
import {NullEngine, Scene, ShaderMaterial, Mesh, Texture, TransformNode} from '@babylonjs/core';
import {TankView} from '../apps/web/src/assets/tanks/tank-view';
import {createRoleTrackTextureState} from '../apps/web/src/assets/tanks/role-track-texture';

// Consumer-only lifecycle contract; real movement/draw acceptance is separate.
const engine = new NullEngine();
const scene = new Scene(engine);
const a = new Texture(null, scene);
const b = new Texture(null, scene);
const root = new TransformNode('track-consumer', scene);
interface TrackConsumer {
  current: {components: {part: string; assets: {meshes: Mesh[]}}[]};
  alive: boolean;
  disposed: boolean;
  root: TransformNode;
  trackPhase: {elapsed: number; index: 0 | 1};
  trackMovementPending: boolean;
  textures: Map<string, Texture>;
  transientAction?: string;
  activeAction: string;
  primaryTags: {update: () => void};
  updatePrimaryTags: () => void;
  applyTrackTexture: () => void;
  actionMessages: {notifyObservers: () => void};
}
const consumer = Object.create(TankView.prototype) as TrackConsumer & Pick<TankView, 'advanceAnimations' | 'trackMovementTarget' | 'position'>;
const meshes = ['X', 'Y', 'M'].map(part => {
  const mesh = new Mesh(part, scene);
  const material = new ShaderMaterial(part, scene, {}, {samplers: ['sourceTexture']});
  material.metadata = {originalMV3: {}};
  material.setTexture('sourceTexture', a);
  mesh.material = material;
  return mesh;
});
Object.assign(consumer, {root, alive: true, disposed: false, trackPhase: createRoleTrackTextureState(),
  trackMovementPending: false, textures: new Map([['XY', a], ['XY-B', b]]), activeAction: '02',
  current: {components: meshes.map(mesh => ({part: mesh.name, action: {duration: 1000}, assets: {meshes: [mesh]}}))},
  updatePrimaryTags: () => {}, actionMessages: {notifyObservers: () => {}}});
function texture(mesh: Mesh): Texture {return mesh.material!.getActiveTextures()[0] as Texture;}
function pending(): void {consumer.trackMovementTarget(-10, 0);}
try {
  pending();consumer.advanceAnimations(.1);
  assert.equal(texture(meshes[0]), a);
  pending();consumer.advanceAnimations(.001);
  assert.equal(texture(meshes[0]), b);assert.equal(texture(meshes[1]), b);
  assert.equal(texture(meshes[2]), a, 'Body must not use track B');
  const suspended = {...consumer.trackPhase};
  consumer.advanceAnimations(.4);
  assert.deepEqual(consumer.trackPhase, suspended, 'No new presentation target freezes animation');
  const phase = {...consumer.trackPhase};
  consumer.trackMovementTarget(0, 0);consumer.advanceAnimations(.4);
  assert.deepEqual(consumer.trackPhase, phase, 'Arrived target freezes phase');
  for (const action of ['03', '05', '06', '07', '08']) {
    consumer.activeAction = action;pending();consumer.advanceAnimations(.11);
    assert.equal(texture(meshes[0]), consumer.trackPhase.index ? b : a);
    assert.equal(texture(meshes[1]), texture(meshes[0]));
  }
  consumer.alive = false;
  const dead = {...consumer.trackPhase};pending();consumer.advanceAnimations(.4);
  assert.deepEqual(consumer.trackPhase, dead, 'Death freezes texture phase');
  consumer.alive = true;consumer.position(30, 0, 40);consumer.advanceAnimations(.4);
  assert.deepEqual(consumer.trackPhase, dead, 'Revive/round snap clears pending motion');
  consumer.trackMovementTarget(30, 40);consumer.advanceAnimations(.11);
  assert.deepEqual(consumer.trackPhase, dead, 'Idle target retains phase');
  consumer.disposed = true;pending();consumer.advanceAnimations(.4);
  assert.deepEqual(consumer.trackPhase, dead, 'Disposed actor cannot animate');
  console.log('PASS: actual TankView consumer, X/Y synchronization, body isolation, target arrival, fire/hurt, death, snap/revive and disposal');
} finally {scene.dispose();engine.dispose();}
