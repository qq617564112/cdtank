import assert from 'node:assert/strict';
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {AccountStore} from '../apps/server/src/account-store';
import {World, type WorldEvent} from '../apps/server/src/world';
import {TANKS} from '../apps/server/src/config';

const attackDrink = process.argv.includes('--attack-drink');
const definitionId = attackDrink ? 4 : 1;

const directory = mkdtempSync(join(tmpdir(), 'cdtank-autopilot-'));
const database = join(directory, 'accounts.sqlite');
let store = new AccountStore(database);
let now = 100000;
try {
  const account = store.open();
  store.replaceInventory(account.accountId, [{instanceId: 77, itemTableId: definitionId, ownedQuantity: 3,
    battleQuantity: 0, state: 0, field8: 9, float24Bits: 0x7fc01234, float28Bits: 0, float2cBits: 0}]);
  store.assign(account.accountId, 77, 4);
  const world: World = new World(() => now, {consumeItem: (id, instance, quantity, definition) => {
    assert.equal(id, owner.playerId);
    return store.consumeItem(account.accountId, instance, quantity, definition);
  }});
  const owner = world.createAndJoin('owned-ai', 4, 7, 'Owned AI', 'Owner', 1);
  world.bindInventory(owner.playerId, store.inventory(account.accountId));
  for (let i = 0; i < 3; i++) world.manageCpu(owner.playerId, 1, 'ADD');
  world.ready(owner.playerId, 1, false);
  world.configureAutopilot(owner.playerId, 1, true);
  assert.equal(world.snapshot(owner.roomId)!.phase, 'WAITING', 'AI control does not prepare or vote for its human');
  assert.throws(() => world.configureAutopilot(owner.playerId, 2, false));
  world.ready(owner.playerId, 1);
  const ordinary = {sequence: 1000, move: 0, turn: 0, aim: 0, fire: false, useItem: 5, clientTime: now};
  assert.deepEqual(world.updateInput(owner.playerId, ordinary), [], 'Manual packets cannot override AI control');
  const uses: WorldEvent[] = [];
  const hits: WorldEvent[] = [];
  function naturalRound(): void {
    for (let tick = 0; tick < 6200 && world.snapshot(owner.roomId)!.phase === 'PLAYING'; tick++) {
      now += 50;
      const step = world.step(50);
      hits.push(...step.events.filter(event => event.type === 'hit'));
      for (const event of step.events.filter(event => event.type === 'itemUsed')) {
        assert.equal(event.playerId, owner.playerId);
        if (!attackDrink) assert(hits.some(hit => hit.targetId === owner.playerId));
        if (attackDrink) {
          assert.equal(event.skillId, 4);
          assert(step.events.some(value => value.type === 'fire' && value.playerId === owner.playerId));
        }
        uses.push(event);
        assert.equal(store.inventory(account.accountId).records[0].ownedQuantity, 3 - uses.length);
      }
    }
    assert.equal(world.snapshot(owner.roomId)!.phase, 'FINISHED');
    if (attackDrink) assert(world.snapshot(owner.roomId)!.players.every(player => !player.attackBoost));
  }
  naturalRound();
  assert(uses.length > 0);
  if (attackDrink) {
    const attack = TANKS.find(tank => tank.id === 1)!.attack;
    assert(hits.some(event => event.playerId === owner.playerId && event.value === 35 + (attack * 2 + 20) * .08));
  }
  const firstUses = uses.length;
  const firstResult = world.snapshot(owner.roomId)!.match!.result;
  assert(world.snapshot(owner.roomId)!.players.find(player => player.id === owner.playerId)!.isAutopilot);
  assert(!world.snapshot(owner.roomId)!.match!.rematchPlayerIds.includes(owner.playerId));
  world.rematch(owner.playerId, 1);
  assert.equal(world.inventory(owner.playerId).records[0].battleQuantity, 3 - uses.length);
  naturalRound();
  assert.equal(world.inventory(owner.playerId).records[0].ownedQuantity, 3 - uses.length);
  world.configureAutopilot(owner.playerId, 2, false);
  assert(!world.snapshot(owner.roomId)!.players.find(player => player.id === owner.playerId)!.isAutopilot);
  world.leave(owner.playerId);
  assert.equal(world.snapshot(owner.roomId), undefined);
  store.close(); store = new AccountStore(database);
  assert.equal(store.inventory(account.accountId).records[0].ownedQuantity, 3 - uses.length);
  assert.equal(store.inventory(account.accountId).records[0].float24Bits, 0x7fc01234);
  const rejoined = world.createAndJoin('owned-ai', 4, 7, 'Rejoin', 'Owner', 1);
  world.bindInventory(rejoined.playerId, store.inventory(account.accountId));
  world.ready(rejoined.playerId, 1);
  world.configureAutopilot(rejoined.playerId, 1, true);
  for (let i = 0; i < 25; i++) {now += 50; world.step(50);}
  world.configureAutopilot(rejoined.playerId, 1, false);
  const before = world.snapshot(rejoined.roomId)!.players[0];
  world.updateInput(rejoined.playerId, {...ordinary, sequence: 1, move: 1, useItem: 0});
  now += 50; world.step(50);
  const after = world.snapshot(rejoined.roomId)!.players[0];
  assert(Math.hypot(after.x - before.x, after.z - before.z) > 0,
    'AI sequence does not consume the manual sequence watermark');
  writeFileSync(`recovery/output/${attackDrink ? 'attack-drink-ai' : 'account-autopilot'}-world.json`, JSON.stringify({status: 'PASS',
    scope: 'Explicit owned account inventory; autonomous ordinary inputs, natural injury/healing and two natural rounds, manual input isolation, persistent consumption, human votes, rejoin. Rebuilt AI control and healing rules.',
    definitionId, attackDrink, firstUses, uses, firstResult, persisted: store.inventory(account.accountId)}, null, 2));
  console.log(`PASS: owned account AI uses ${uses.length} portions, natural two rounds and persistent stock`);
} finally {
  store.close(); rmSync(directory, {recursive: true, force: true});
}
