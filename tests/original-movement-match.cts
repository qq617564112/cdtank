import assert from 'node:assert/strict';
import {readFileSync, writeFileSync, mkdtempSync, rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {AccountStore} from '../apps/server/src/account-store';
import {World} from '../apps/server/src/world';

const source: {rows: {tankId: number; part: number; base: Record<string, number>; equipment: Record<string, number>}[]} =
  JSON.parse(readFileSync('recovery/output/world-role-attributes-native.json', 'utf8'));
function bindMovementSource(world: World, id: string, tankId: number) {
  const row = source.rows.find(row => row.tankId === tankId && row.part === 0)!;
  assert(row, 'Require an explicit original owned-source fixture for each CPU tank');
  const fields = (value: Record<string, number>) => new Map(Object.entries(value).map(([key, value]) => [Number(key), value]));
  world.bindRoleSources(id, {base: {name: 'Explicit native pet fixture', fields: fields(row.base)},
    equipment: {name: 'Explicit native owned tank fixture', fields: fields(row.equipment)}});
}
// Reproducible ordinary respawn choices; no spawn/position injection.
const originalRandom = Math.random;
let randomState = 0xcd7a2026;
Math.random = () => {randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
  return randomState / 0x100000000;};
let now = 100000;
const evidence = [];
const directory = mkdtempSync(join(tmpdir(), 'cdtank-autopilot-modes-'));
const database = join(directory, 'accounts.sqlite');
let store = new AccountStore(database);
try {
  for (const mode of (process.argv[2] ? [Number(process.argv[2])] : [1, 2, 3, 4, 5])) {
    const account = store.open();
    store.replaceInventory(account.accountId, [{instanceId: 77, itemTableId: 1, ownedQuantity: 3,
      battleQuantity: 0, state: 0, field8: 9, float24Bits: 0x7fc01234, float28Bits: 0, float2cBits: 0}]);
    store.assign(account.accountId, 77, 4);
    let used = 0;
    const world: World = new World(() => now, {consumeItem: (id, instance, quantity, definition) => {
      assert.equal(id, joined.playerId);
      return store.consumeItem(account.accountId, instance, quantity, definition);
    }});
    const maps = world.listMaps();
    const mapId = mode === 1 || mode === 4 ? 7 : mode === 5 ? 20 : 2;
    const joined = world.createAndJoin(`human-${mode}`, mode, mapId, 'CPU validation', 'Observer', 1);
    const snapshot = () => world.snapshot(joined.roomId)!;
    bindMovementSource(world, joined.playerId, 1);
    const cpuIds: string[] = [];
    const count = Math.max(4, maps.find(m => m.mode === mode && m.mapId === mapId)!.sourceMinPlayers);
    for (let index = 1; index < count; index++) {
      const tankId = index % 2 ? 1 : 105;
      const id = world.manageCpu(joined.playerId, 1, 'ADD', tankId);
      bindMovementSource(world, id, tankId);
      cpuIds.push(id);
    }
    for (const id of cpuIds) world.ready(id, 1);
    assert.equal(snapshot().phase, 'WAITING');
    assert.equal(snapshot().match!.readyPlayerIds.length, count - 1);
    assert(snapshot().players.filter(p => cpuIds.includes(p.id)).every(p => p.isCpu));
    assert.throws(() => world.manageCpu(cpuIds[0], 1, 'ADD', 1));
    const other = world.joinRoom(joined.roomId, `guest-${mode}`, 'Guest', 1);
    assert.throws(() => world.manageCpu(other.playerId, 1, 'ADD', 1));
    world.leave(other.playerId);
    world.bindInventory(joined.playerId, store.inventory(account.accountId));
    world.configureAutopilot(joined.playerId, 1, true);
    assert(!snapshot().match!.readyPlayerIds.includes(joined.playerId));
    world.ready(joined.playerId, 1);
    assert.equal(snapshot().phase, 'PLAYING');
    assert.throws(() => world.manageCpu(joined.playerId, 1, 'REMOVE', 1, cpuIds[0]));
    const rounds = [];
    let originalPoseObserved = false;
    for (const round of [1, 2]) {
      assert.equal(snapshot().match!.round, round);
      const initial = snapshot();
      let fire = 0, hit = 0, deaths = 0, respawns = 0;
      let ownerFire = 0, ownerHits = 0, ownerMoved = false;
      const stock = world.inventory(joined.playerId).records[0].ownedQuantity;
      const positions = new Map(initial.players.map(p => [p.id, [p.x, p.z]]));
      let moved = false;
      for (let tick = 0; tick < 6200 && snapshot().phase === 'PLAYING'; tick++) {
        now += 50;
        const step = world.step(50);
        if (mode === 5 && tick % 1000 === 0) console.log(JSON.stringify({round, tick, players:snapshot().players.map(p=>[p.x,p.z,p.kills,p.objectivesDestroyed]),fire,hit}));
        ownerFire += step.events.filter(e => e.type === 'fire' && e.playerId === joined.playerId).length;
        ownerHits += step.events.filter(e => (e.type === 'hit' || e.type === 'objectiveHit') && e.playerId === joined.playerId).length;
        for (const event of step.events.filter(e => e.type === 'itemUsed')) {
          assert.equal(event.playerId, joined.playerId); used++;
          assert.equal(store.inventory(account.accountId).records[0].ownedQuantity, 3 - used);
        }
        const owner = snapshot().players.find(p => p.id === joined.playerId)!;
        originalPoseObserved ||= snapshot().players.some(player => player.bodyYaw !== undefined);
        ownerMoved ||= Math.hypot(owner.x - positions.get(owner.id)![0], owner.z - positions.get(owner.id)![1]) > 20;
        fire += step.events.filter(e => e.type === 'fire' && cpuIds.includes(e.playerId)).length;
        hit += step.events.filter(e => (e.type === 'hit' || e.type === 'objectiveHit') && cpuIds.includes(e.playerId)).length;
        deaths += step.events.filter(e => e.type === 'destroy').length;
        respawns += step.events.filter(e => e.type === 'respawn').length;
        if (tick % 20 === 0) moved ||= snapshot().players.some(p => p.isCpu
          && Math.hypot(p.x - positions.get(p.id)![0], p.z - positions.get(p.id)![1]) > 20);
      }
      const finished = snapshot();
      assert(finished.players.filter(player => player.isCpu).every(player => player.selectedAmmoSlot === 1),
        'CPUs must select default ammo through the same authoritative shortcut input');
      assert(finished.players.find(p => p.id === joined.playerId)!.isAutopilot);
      assert(ownerMoved, `Owned AI should move in mode ${mode}`);
      assert(ownerFire > 0, `Owned AI should fire in mode ${mode}`);
      assert(ownerHits > 0, `Owned AI should hit in mode ${mode}`);
      assert.equal(world.inventory(joined.playerId).records[0].ownedQuantity, 3 - used);
      assert.equal(world.inventory(joined.playerId).records[0].battleQuantity, 3 - used);
      assert(stock >= 3 - used);
      assert.equal(finished.phase, 'FINISHED');
      if (mode === 5) {
        assert.equal(finished.match!.result!.reason, 'OBJECTIVE', 'Original footprint CPU must finish destruction, not wait for timeout');
        assert(finished.match!.objectives.every(objective => objective.hp === 0),
          'All actual source destruction objectives must be cleared by ordinary inputs');
      }
      assert(moved, `CPU should navigate in mode ${mode}`);
      assert(fire > 0, `CPU should fire in mode ${mode}`);
      assert(hit > 0, `CPU should hit in mode ${mode}`);
      if (mode === 1 || mode === 4) assert(respawns > 0);
      const frozen = structuredClone(finished.match!.result);
      now += 1000; world.step(1000);
      assert.deepEqual(snapshot().match!.result, frozen);
      rounds.push({round, fire, hit, ownerFire, ownerHits, ownerMoved, used, stock, deaths, respawns, initial, finished});
      console.log(JSON.stringify({mode, round, fire, hit, deaths, respawns, reason: frozen!.reason}));
      if (round === 1) {
        world.rematch(joined.playerId, round);
        assert.equal(snapshot().phase, 'PLAYING');
        assert.equal(snapshot().match!.round, 2);
        assert.equal(world.inventory(joined.playerId).records[0].battleQuantity, 3 - used);
        assert.deepEqual(snapshot().players.filter(player => player.isCpu).map(player => player.id), cpuIds);
        assert(snapshot().players.every(player => player.alive && player.hp === player.maxHp
          && player.kills === 0 && player.deaths === 0 && player.objectivesDestroyed === 0));
      }
    }
    assert(originalPoseObserved, 'Natural ordinary inputs must run original movement and publish independent body angles');
    world.leave(joined.playerId);
    assert.equal(world.snapshot(joined.roomId), undefined, 'No orphan CPU rooms after last human leaves');
    store.close(); store = new AccountStore(database);
    assert.equal(store.inventory(account.accountId).records[0].ownedQuantity, 3 - used);
    assert.equal(store.inventory(account.accountId).records[0].float24Bits, 0x7fc01234);
    evidence.push({mode, ...rounds[0], persisted: store.inventory(account.accountId), rounds});
    writeFileSync(`recovery/output/original-movement-match-mode${mode}.json`, JSON.stringify(evidence.at(-1), null, 2));
  }
  writeFileSync('recovery/output/original-movement-match.json', JSON.stringify({respawnSeed: '0xcd7a2026', scope: 'World owned-account autopilot and CPU normal 50ms inputs/physics, unchanged counts/time, persistent source inventory and actual consumption. Simulated clock, no damage/position injections; not browser or original AI fidelity.', evidence}, null, 2));
  console.log(`PASS: explicit original owned sources and restored movement, AI/CPU modes ${evidence.map(row=>row.mode).join(',')}, two complete rounds, ordinary rules, readiness, frozen settlement, rematch and room cleanup`);

} finally {Math.random = originalRandom; store.close(); rmSync(directory, {recursive: true, force: true});}
