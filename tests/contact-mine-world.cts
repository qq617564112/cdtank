import assert from 'node:assert/strict';
import {copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {AccountStore} from '../apps/server/src/account-store';
import {consumableShopItems} from '../apps/server/src/accounts/shop-catalog';
import {combatCatalog} from '../apps/server/src/battle/catalog';
import {World} from '../apps/server/src/world';

const source = 'recovery/output/browser-pet-copy-skill-2026-10-06T01-49-31-259Z';
const directory = mkdtempSync(join(tmpdir(), 'cdtank-contact-mine-world-'));
const database = join(directory, 'accounts.sqlite');
copyFileSync(source + '-checkpoint.sqlite', database);
const identities = JSON.parse(readFileSync(source + '-checkpoint-fixture.json', 'utf8')).accounts as {accountId: string}[];
const store = new AccountStore(database);
try {
  const bought = store.shop(identities[0].accountId, consumableShopItems(combatCatalog),
    {operation: 'BUY', itemTableId: 3002, quantity: 3, currency: 'MONEY', requestId: 'contact-mine-world-buy'});
  assert(bought.purchased);
  store.assign(identities[0].accountId, bought.purchased.instanceId, 1);
  let now = 100000;
  const world = new World(() => now, {consumeItem: (_id, instance, quantity, item) =>
    store.consumeItem(identities[0].accountId, instance, quantity, item)});
  const host = world.createAndJoin('bomb-host', 4, 7, '地雷', 'Owner', 3);
  const peer = world.joinRoom(host.roomId, 'bomb-peer', 'Peer', 3);
  for (const [index, participant] of [host, peer].entries()) {
    const id = identities[index].accountId;
    world.bindInventory(participant.playerId, store.inventory(id));
    world.bindRoleSources(participant.playerId, store.selectedRoleSources(id));
    world.bindEquipmentProfile(participant.playerId, store.roleProfile(id));
  }
  world.ready(host.playerId, 1); world.ready(peer.playerId, 1);
  const input = {sequence: 1, move: 0, turn: 0, aim: 0, fire: false, useItem: 2, clientTime: 0};
  assert(world.updateInput(host.playerId, input).some(e => e.type === 'trapPlaced'));
  const placed = world.snapshot(host.roomId)!.match!.groundTraps![0];
  assert.equal(placed.expiresAt, now + 30000);
  let explosions = 0;
  for (let tick = 1; tick <= 600; tick++) {
    now += 50;
    const step = world.step(50);
    explosions += step.events.filter(e => e.type === 'trapTriggered' && e.skillId === 4023).length;
    if (tick < 600) {
      assert.equal(explosions, 0);
      assert.equal(world.snapshot(host.roomId)!.match!.groundTraps!.length, 1);
    }
  }
  assert.equal(explosions, 0); assert.equal(world.snapshot(host.roomId)!.match!.groundTraps!.length, 0);
  assert(world.updateInput(host.playerId, {...input, sequence: 2}).some(e => e.type === 'trapPlaced'));
  world.leave(peer.playerId);
  assert.equal(world.snapshot(host.roomId)!.phase, 'FINISHED');
  assert.equal(world.snapshot(host.roomId)!.match!.groundTraps!.length, 0);
  now += 31000; assert(!world.step(31000).events.some(e => e.type === 'trapTriggered'));
  world.leave(host.playerId); assert.equal(world.snapshot(host.roomId), undefined);
  const renewed = world.createAndJoin('bomb-host', 4, 7, '地雷清理', 'Owner', 3);
  world.bindInventory(renewed.playerId, store.inventory(identities[0].accountId));
  world.bindRoleSources(renewed.playerId, store.selectedRoleSources(identities[0].accountId));
  world.bindEquipmentProfile(renewed.playerId, store.roleProfile(identities[0].accountId));
  world.manageCpu(renewed.playerId, 1, 'ADD', 1); world.ready(renewed.playerId, 1);
  assert(world.updateInput(renewed.playerId, input).some(e => e.type === 'trapPlaced'));
  world.leave(renewed.playerId);
  now += 31000; assert(!world.step(31000).events.some(e => e.type === 'trapTriggered'));
  assert.equal(store.inventory(identities[0].accountId).records.find(r => r.instanceId === bought.purchased!.instanceId)!.ownedQuantity, 0);
  writeFileSync('recovery/output/contact-mine-world.json', JSON.stringify({
    status: 'PASS_ORDINARY_BUY_KITBAG_CONTACT_MINE_WORLD_EXPIRY_FINISH_LEAVE_DURABLE_CONSUMPTION_SCOPE',
    source: source + '-checkpoint.sqlite', fixture: 'Legal checkpoint clone, ordinary BUY3/Kitbag1/native-equivalent hotkey inputs; no Point, funds, owned or active state injection',
    simulationTickSeconds: .05, realtimeNetworkProved: false, explosions,
    timerMs: 30000, finishClears: true, leaveClears: true, threePersistentConsumptions: true,
  }, null, 2) + '\n');
  console.log('PASS contact mine World normal BUY/Kitbag/hotkey, expiry, FINISHED and Leave cleanup');
} finally {store.close(); rmSync(directory, {recursive: true, force: true});}
