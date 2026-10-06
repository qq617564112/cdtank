import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {transpileModule, ModuleKind, JsxEmit, ScriptTarget} from 'typescript';
import {World} from '../apps/server/src/world';
import type {MsgRoomSnapshot} from '../apps/shared/protocols';
import type {BattleMatch as BattleMatchType} from '../apps/web/src/interface/battle/battle-match';

// Execute the production store with only its unused view/CSS imports isolated.
// The browser workflow tests mount the real React and WaitingRoom views.
const source = readFileSync('apps/web/src/interface/battle/battle-match.tsx', 'utf8')
  .replace("import './match.css';", '');
const compiled = transpileModule(source, {compilerOptions: {
  module: ModuleKind.CommonJS, jsx: JsxEmit.ReactJSX, target: ScriptTarget.ES2022,
}}).outputText;
const exported = {} as {BattleMatch: typeof BattleMatchType};
runInNewContext(compiled, {
  exports: exported, Error,
  require: (id: string): unknown => id.startsWith('.') ? {} : require(id),
});
const {BattleMatch} = exported;
const flush = () => new Promise<void>(resolve => setImmediate(resolve));

async function main(): Promise<void> {
  let clock = 1000000;
  const world = new World(() => clock, {timeLimitSeconds: 1, minPlayers: 2});
  const room = world.listRooms().find(value => value.mode === 4)!;
  const owner = world.joinRoom(room.id, 'store-owner', 'Owner', 1);
  const guest = world.joinRoom(room.id, 'store-guest', 'Guest', 1);
  const snapshot = (): MsgRoomSnapshot => world.snapshot(room.id)!;
  const panel = new BattleMatch(async () => {}, async () => {}, async () => {});
  let notifications = 0;
  const unsubscribe = panel.subscribe(() => {notifications++;});

  panel.update(snapshot(), owner.playerId);
  assert.equal(notifications, 1);
  assert.equal(panel.getSnapshot()!.phase, 'WAITING');
  assert.equal(panel.getSnapshot()!.ready, false);
  const initial = panel.getSnapshot();
  const waiting = snapshot();
  panel.update({...waiting, tick: waiting.tick + 1, serverTime: waiting.serverTime + 50,
    players: waiting.players.map(player => ({...player, x: player.x + 10, yaw: player.yaw + 1})),
    bullets: [{id: 'waiting-bullet', ownerId: owner.playerId, x: 1, y: 1, z: 1, vx: 0, vy: 0, vz: 0, damage: 1}],
  }, owner.playerId);
  assert.equal(panel.getSnapshot(), initial, 'waiting simulation-only changes preserve the store reference');
  assert.equal(notifications, 1);
  assert.equal(panel.getSnapshot()!.waiting!.tick, 0);
  assert.equal(panel.getSnapshot()!.waiting!.players[0].x, 0);
  assert.equal(panel.getSnapshot()!.waiting!.bullets.length, 0);

  world.ready(owner.playerId, 1);
  panel.update(snapshot(), owner.playerId);
  assert.equal(notifications, 2, 'confirmed ready state publishes immediately');
  assert.equal(panel.getSnapshot()!.ready, true);
  assert.equal(panel.getSnapshot()!.players.find(player => player.id === owner.playerId)!.ready, true);
  world.ready(guest.playerId, 1);
  panel.update(snapshot(), owner.playerId);
  assert.equal(notifications, 3, 'WAITING to PLAYING publishes immediately');
  assert.equal(panel.getSnapshot()!.phase, 'PLAYING');
  assert.equal(panel.getSnapshot()!.waiting, undefined);
  assert.equal(panel.getSnapshot()!.players.length, 0);
  const playing = snapshot();
  const stockPanel = new BattleMatch(async () => {}, async () => {}, async () => {});
  const stocks = (quantity: number, peerQuantity = 2): MsgRoomSnapshot => ({...playing,
    players: playing.players.map(player => ({...player,
      ammoSlots: [{slot: 2, itemTableId: 2007, quantity: player.id === owner.playerId ? quantity : peerQuantity}]}))});
  stockPanel.update(stocks(2), owner.playerId);
  stockPanel.update(stocks(1), owner.playerId);
  assert.equal(stockPanel.getSnapshot()!.ammoSlots[0].quantity, 1, 'Confirmed local stock loss publishes');
  const localStockState = stockPanel.getSnapshot();
  stockPanel.update(stocks(1, 0), owner.playerId);
  assert.equal(stockPanel.getSnapshot(), localStockState, 'Another participant stock cannot change the local inventory view');
  stockPanel.update(stocks(0), owner.playerId);
  assert.equal(stockPanel.getSnapshot()!.ammoSlots[0].quantity, 0, 'Exhausted slots remain visible');
  stockPanel.clear();
  assert.equal(stockPanel.getSnapshot(), undefined, 'Leaving clears the ammunition view');
  const playingState = panel.getSnapshot();
  panel.update({...playing, tick: playing.tick + 1, serverTime: playing.serverTime + 50,
    players: playing.players.map(player => ({...player, x: player.x + 30, z: player.z + 20, hp: player.hp - 1})),
    bullets: [{id: 'live-bullet', ownerId: owner.playerId, x: 1, y: 1, z: 1, vx: 0, vy: 0, vz: 0, damage: 1}],
  }, owner.playerId);
  assert.equal(panel.getSnapshot(), playingState, 'mode 4 position, HP, tick and bullets do not publish');
  assert.equal(notifications, 3);

  const boosted = {...playing, players: playing.players.map(player => player.id === owner.playerId
    ? {...player, speedBoost: {skillId: 1, expiresAt: clock + 4500, moveBonus: 2}} : player)};
  panel.update(boosted, owner.playerId);
  assert.match(panel.getSnapshot()!.boosts[0].text, /剩余 5 秒/);
  const boostState = panel.getSnapshot();
  panel.update({...boosted, serverTime: clock + 50}, owner.playerId);
  assert.equal(panel.getSnapshot(), boostState, 'unchanged boost seconds preserve the store reference');
  panel.update({...boosted, serverTime: clock + 1000}, owner.playerId);
  assert.match(panel.getSnapshot()!.boosts[0].text, /剩余 4 秒/);

  const capture: MsgRoomSnapshot = {...playing, mode: 2,
    match: {...playing.match!, objectives: [{id: 'zone', kind: 'CAPTURE', x: 100, y: 0, z: 100,
      radius: 5, hp: 1, maxHp: 1, ownerTeam: -1, contested: false}]},
  };
  panel.update(capture, owner.playerId);
  const direction = panel.getSnapshot()!.objective;
  const movedCapture = {...capture, serverTime: clock + 50,
    players: capture.players.map(player => ({...player, x: 0, z: 0, yaw: Math.PI}))};
  panel.update(movedCapture, owner.playerId);
  assert.equal(panel.getSnapshot()!.objective, direction, 'target guidance is stable within the server second');
  panel.update({...movedCapture, serverTime: clock + 1000}, owner.playerId);
  assert.notEqual(panel.getSnapshot()!.objective, direction, 'target guidance refreshes on the next server second');

  clock += 2000;
  world.step(2000);
  panel.update(snapshot(), owner.playerId);
  assert.equal(panel.getSnapshot()!.phase, 'FINISHED');
  assert.equal(panel.getSnapshot()!.results.length, 2);
  assert.equal(panel.getSnapshot()!.boosts.length, 0);
  const finishedNotifications = notifications;
  const finishedState = panel.getSnapshot();
  panel.update({...snapshot(), tick: snapshot().tick + 10, serverTime: clock + 1000}, owner.playerId);
  assert.equal(panel.getSnapshot(), finishedState);
  assert.equal(notifications, finishedNotifications);
  world.rematch(owner.playerId, 1);
  panel.update(snapshot(), owner.playerId);
  assert.equal(notifications, finishedNotifications + 1, 'rematch confirmation publishes immediately');
  assert.equal(panel.getSnapshot()!.voted, true);
  world.rematch(guest.playerId, 1);
  panel.update(snapshot(), owner.playerId);
  assert.equal(panel.getSnapshot()!.phase, 'PLAYING');
  assert.equal(panel.getSnapshot()!.round, 2);
  assert.equal(panel.getSnapshot()!.results.length, 0);
  unsubscribe();

  let rejectRequest: (error: Error) => void = () => {throw new Error('request has not started');};
  const pendingPanel = new BattleMatch(async () => {},
    () => new Promise<void>((_resolve, reject) => {rejectRequest = reject;}), async () => {});
  pendingPanel.update(waiting, owner.playerId);
  pendingPanel.setReadyAvailable(true);
  pendingPanel.requestReady();
  assert.equal(pendingPanel.getSnapshot()!.pending, true);
  rejectRequest(new Error('服务器拒绝准备'));
  await flush();
  assert.equal(pendingPanel.getSnapshot()!.pending, false);
  assert.equal(pendingPanel.getSnapshot()!.status, '服务器拒绝准备');
  pendingPanel.update(waiting, owner.playerId);
  assert.equal(pendingPanel.getSnapshot()!.status, '服务器拒绝准备', 'unchanged roster retains the rejection');
  pendingPanel.requestReady();
  pendingPanel.clear();
  pendingPanel.update(playing, owner.playerId);
  const replacement = pendingPanel.getSnapshot();
  rejectRequest(new Error('旧房间请求拒绝'));
  await flush();
  assert.equal(pendingPanel.getSnapshot(), replacement, 'completion after clear cannot overwrite the next context');
  assert.equal(pendingPanel.getSnapshot()!.pending, false);
  assert.equal(pendingPanel.getSnapshot()!.status, '');
  pendingPanel.clear();
  assert.equal(pendingPanel.getSnapshot(), undefined);

  writeFileSync('recovery/output/react-match-store.json', JSON.stringify({
    status: 'PASS', productionStore: 'apps/web/src/interface/battle/battle-match.tsx',
    fixture: 'World mode 4 snapshots with ready, time-limit result and rematch',
    isolation: 'TypeScript transpilation; CSS and unused relative view imports isolated',
    simulationChangesDoNotPublish: true, waitingSnapshotHasNoWorldData: true,
    readyAndPhaseChangesPublish: true, resultsAndRematchPublish: true,
    boostSecondsPublish: true, targetGuidanceUpdatesOncePerServerSecond: true,
    pendingRejectionPersists: true, clearInvalidatesPendingCompletion: true,
    notifications,
  }, null, 2) + '\n');
  console.log('PASS: production match store semantic subscriptions, ready/phases/results/rematch, boost seconds, target guidance, pending rejection and clear invalidation');
}

void main().catch(error => {console.error(error); process.exitCode = 1;});
