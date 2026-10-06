import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {BattleSound} from '../apps/web/src/audio/battle-sound';
import type {MsgRoomEvent} from '../apps/shared/protocols/MsgRoomEvent';
import type {MsgRoomSnapshot} from '../apps/shared/protocols/MsgRoomSnapshot';
import {TankShotItemResult} from '../apps/web/src/assets/tanks/shot-item-result';
const catalog = JSON.parse(readFileSync('recovery/output/web-assets/combat-catalog.json', 'utf8'));
const calls: unknown[][] = [];
const consumer = new TankShotItemResult({spawnWorldEffect: (...args) => {
  calls.push(['endpoint', ...args]); return 1;
}, playShotSound: (...args) => {calls.push(['endpointSound', ...args]); return 1;}}, catalog);
const message = {itemId: 2002, x: 123.45, y: 25, z: -77.1};
consumer.show(message, 'remote', 'local', () => {calls.push(['shotFeedback']);});
assert.deepEqual(calls, [['endpoint', '_root\\online\\008',
  [Math.fround(123.45), 25, Math.fround(-77.1)]], ['endpointSound', 'SE31'], ['shotFeedback']]);
calls.length = 0;
consumer.show(message, 'local', 'local', () => {calls.push(['shotFeedback']);});
consumer.show({...message, itemId: 2011}, 'remote', 'local', () => {calls.push(['shotFeedback']);});
assert.deepEqual(calls, []);
const status = {dataset: {} as Record<string, string>};
Object.assign(globalThis, {document: {createElement: () => status, body: {append() {}}},
  window: {addEventListener() {}}});
const sound = new BattleSound();
const created: any[] = [];
const node = () => ({connect() {}, disconnect() {}, gain: {value: 1},
  positionX: {value: 0}, positionY: {value: 0}, positionZ: {value: 0},
  start() {created.push(this);}});
const audio = JSON.parse(readFileSync('recovery/output/web-assets/audio.json', 'utf8'));
Object.assign(sound, {active: true, catalog: audio, gain: node(), buffers: new Map([[51, {}]]),
  context: {state: 'running', currentTime: 5, createBufferSource: node, createPanner: node, createGain: node}});
const event = {type: 'sceneObjectDestroyed', roomId: 'R1', playerId: 'remote', targetId: 'ENV:1'} as MsgRoomEvent;
const snapshot = {roomId: 'R1', mode: 1, players: [
  {id: 'remote', x: 125, y: 20, z: -77, team: 1}, {id: 'local', team: 0}]} as MsgRoomSnapshot;
sound.shotItemResult(event, snapshot, 'local', 2002);
assert.equal(created.length, 1);
assert.equal(created[0].loop, false);
assert.deepEqual(JSON.parse(status.dataset.events), [{soundId: 51, type: 'sceneObjectDestroyed',
  skillId: 2002, playerId: 'remote', targetId: 'ENV:1', x: 125, y: 20, z: -77, contextTime: 5}]);
sound.shotItemResult({...event, playerId: 'local'}, snapshot, 'local', 2002);
sound.shotItemResult(event, snapshot, 'local', 2011);
assert.equal(created.length, 1);
writeFileSync('recovery/output/combat-shot-item-result-2002.json', JSON.stringify({status: 'PASS', scope: 'Ordinary2002 remote scene-result endpoint008/f32XYZ and2DSE31 precede Shot feedback; local and unrelated ammo silent'}, null, 2) + '\n');
console.log('PASS: ordinary2002 remote scene-result endpoint before Shot feedback; local silent');
