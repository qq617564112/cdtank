import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {ArcRotateCamera, NullEngine, Observable, RawTexture, Scene, TransformNode, Vector3} from '@babylonjs/core';
import type {CombatCatalog} from '../apps/shared/combat/catalog';
import type {PlayerSnapshot} from '../apps/shared/protocols/MsgRoomSnapshot';
import type {TankView} from '../apps/web/src/assets/tanks/tank-view';
import {BattleSkillEffects} from '../apps/web/src/match/skills/battle-skill-effects';
import {createSkillEffectNotifications} from '../apps/web/src/match/skills/skill-effect-runtime';
import {BattlePlayers} from '../apps/web/src/render/battle-players';
import {EffectRuntime} from '../apps/web/src/render/effects/runtime/effect-runtime';
import type {EffectRuntimeLibrary} from '../apps/web/src/render/effects/runtime/effect-runtime-tree';
import {EFFECT_IDENTITY} from '../apps/web/src/render/effects/common/effect-render-transform';
import type {SkillSoundCatalog} from '../apps/web/src/audio/effect-skill-sound';

class AudioBoundary extends EventTarget {
  static readonly created: AudioBoundary[] = [];
  loop = false;
  paused = false;
  constructor(readonly src: string) {super(); AudioBoundary.created.push(this);}
  play(): Promise<void> {return Promise.resolve();}
  pause(): void {this.paused = true;}
}
function audioNode(): object {
  return {connect: () => {}, disconnect: () => {}, gain: {value: 0},
    positionX: {value: 0}, positionY: {value: 0}, positionZ: {value: 0},
    orientationX: {value: 0}, orientationY: {value: 0}, orientationZ: {value: 0}};
}
class AudioContextBoundary {
  state = 'running';
  close(): Promise<void> {this.state = 'closed'; return Promise.resolve();}
  destination = {};
  listener = Object.fromEntries(['position', 'forward', 'up'].flatMap(name => ['X', 'Y', 'Z'].map(axis => [`${name}${axis}`, {value: 0}])));
  createGain(): object {return audioNode();}
  createPanner(): object {return audioNode();}
  createMediaElementSource(): object {return audioNode();}
}
const globals = ['Audio', 'AudioContext', 'window'].map(name => ({name, descriptor: Object.getOwnPropertyDescriptor(globalThis, name)}));
Object.defineProperty(globalThis, 'Audio', {value: AudioBoundary, configurable: true});
Object.defineProperty(globalThis, 'AudioContext', {value: AudioContextBoundary, configurable: true});
Object.defineProperty(globalThis, 'window', {value: {addEventListener: () => {}, removeEventListener: () => {}}, configurable: true});
const engine = new NullEngine();
const scene = new Scene(engine);
try {
  const camera = new ArcRotateCamera('camera', Math.PI / 2, Math.PI / 2, 100, Vector3.Zero(), scene);
  camera.getViewMatrix(true);
  camera.getProjectionMatrix(true);
  const runtime = new EffectRuntime(scene, camera);
  const loaded = runtime as unknown as {library: EffectRuntimeLibrary; textures: Map<string, RawTexture>;
    instances: {handle: number}[]; skillSound: {configure(catalog: SkillSoundCatalog): void; voices: Map<number, unknown>}};
  loaded.library = JSON.parse(readFileSync('recovery/output/web-assets/effect-library.json', 'utf8')) as EffectRuntimeLibrary;
  const drawNodes = [2664, 2665, 2667, 2830, 2834];
  for (const grid of loaded.library.textureGrids.filter(grid => drawNodes.includes(grid.node))) {
    if (!loaded.textures.has(grid.asset)) loaded.textures.set(grid.asset,
      RawTexture.CreateRGBATexture(new Uint8Array([255, 255, 255, 255]), 1, 1, scene));
  }
  loaded.skillSound.configure(JSON.parse(readFileSync('recovery/output/web-assets/audio.json', 'utf8')) as SkillSoundCatalog);
  const root = new TransformNode('actor', scene);
  const life: boolean[] = [];
  const view = {root, tankId: 1, turretYaw: 0, trackMovementTarget: () => {},
    position: (x: number, y: number, z: number) => root.position.set(-x, y, z),
    actionMessages: new Observable(),
    primaryTag: (name: string) => name === 'tag_efcenter' ? EFFECT_IDENTITY : undefined,
    life: async (alive: boolean) => {life.push(alive);}, motion: async () => {}, aim: () => {},
    dispose: () => root.dispose()} as unknown as TankView;
  const catalog = JSON.parse(readFileSync('recovery/output/web-assets/combat-catalog.json', 'utf8')) as CombatCatalog;
  let revivalCalls = 0;
  const players = new BattlePlayers(scene, camera, {
    queuedParts: () => false,
    attach: actor => runtime.attach(actor), detach: actor => runtime.detach(actor),
    remove: id => battle.remove(id), revive: id => {revivalCalls++; battle.revive(id);},
  });
  const notifications = createSkillEffectNotifications(runtime, catalog, {role: id => players.get(`P${id}`), localRole: () => view});
  const battle = new BattleSkillEffects(notifications);
  (players as unknown as {players: Map<string, TankView>}).players.set('P47', view);
  const player: PlayerSnapshot = {id: 'P47', name: '饲料', tankId: 1, team: 0, x: 0, y: 0, z: 0,
    yaw: 0, aim: 0, hp: 200, maxHp: 300, alive: true, score: 0, kills: 0, deaths: 0, respawnAt: 0, isVIP: false};
  const snapshot = (alive: boolean): void => {players.reconcile([{...player, alive, hp: alive ? 200 : 0}]); players.render(1);};
  const play = (): void => battle.event({roomId: 'R1', type: 'itemUsed', message: '', playerId: 'P47', targetId: '',
    value: 0, x: 0, y: 0, z: 0,
    playSkillEffect: {skillId: 1, effectIndex: 0, duration: 0, roleId: 47, xBits: 0, zBits: 0}});
  runtime.start();
  snapshot(true);
  play();
  runtime.update(.05);
  const handle = loaded.instances[0].handle;
  assert.equal(loaded.skillSound.voices.size, 1);
  assert.equal(AudioBoundary.created[0].loop, false);
  assert.equal(notifications.records.length, 0);
  assert.equal(notifications.queues.size, 0);
  snapshot(false);
  assert.equal(loaded.instances[0].handle, handle);
  assert.equal(loaded.skillSound.voices.size, 1);
  snapshot(true);
  assert.equal(revivalCalls, 1);
  assert.equal(loaded.instances[0].handle, handle);
  assert.equal(AudioBoundary.created.length, 1, 'revival does not replay first-item sound');
  battle.stop({skillId: 1, roleId: 47});
  assert.equal(loaded.instances[0].handle, handle, 'original one-shot has no retained stop record');
  for (let tick = 0; tick < 200 && loaded.instances.length; tick++) runtime.update(.025);
  assert.equal(loaded.instances.length, 0);
  AudioBoundary.created[0].dispatchEvent(new Event('ended'));
  assert.equal(loaded.skillSound.voices.size, 0);
  assert.equal(AudioBoundary.created[0].paused, true);
  play();
  runtime.update(.05);
  players.reconcile([]);
  assert.equal(players.size, 0);
  assert.equal(loaded.instances.length, 0);
  assert.equal(scene.meshes.length, 0);
  assert.equal(loaded.skillSound.voices.size, 1, 'detached first-item one-shot finishes independently');
  runtime.stop();
  assert.equal(loaded.skillSound.voices.size, 0);
  assert.equal(AudioBoundary.created[1].paused, true);
  assert.deepEqual(life, [true, false, true]);
  writeFileSync('recovery/output/healing-effect-life.json', `${JSON.stringify({status: 'PASS', item: 1, skill: 1,
    death: 'one-shot continues', revival: 'no effect or sound replay', stopNotification: 'no retained record',
    naturalExpiry: true, naturalAudioEnd: true, roleRemovalGeometry: true, battleStopAudio: true,
    scope: 'Production BattlePlayers snapshots, BattleSkillEffects notifications, EffectRuntime geometry and EffectSkillSound lifecycle. TankView actor animation and WebAudio device are fixture boundaries; original actor death/one-shot audio policy is not established by this test.'}, null, 2)}\n`);
  console.log('PASS: first-item death/revival snapshots, no replay or queue, natural expiry/audio end, role-removal geometry and battle-stop audio cleanup');
} finally {
  scene.dispose();
  engine.dispose();
  for (const global of globals) {
    if (global.descriptor) Object.defineProperty(globalThis, global.name, global.descriptor);
    else Reflect.deleteProperty(globalThis, global.name);
  }
}
