import assert from 'node:assert/strict';
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {World} from '../apps/server/src/world';
import {AccountStore} from '../apps/server/src/account-store';

const directory = mkdtempSync(join(tmpdir(), 'cdtank-invincible-world-'));
let store = new AccountStore(join(directory, 'accounts.sqlite'));
try {
  const account = store.open();
  const item = {instanceId: 77, itemTableId: 8, ownedQuantity: 3, battleQuantity: 0, state: 0,
    field8: 9, float24Bits: 0x7fc01234, float28Bits: 0, float2cBits: 0};
  store.replaceInventory(account.accountId, [item]); store.assign(account.accountId, 77, 4);
  let now = 100000, allow = true;
  const world = new World(() => now, {consumeItem: (_id, instance, quantity, definition) =>
    allow && store.consumeItem(account.accountId, instance, quantity, definition)});
  const host = world.createAndJoin('invincible', 4, 7, 'Invincible', 'Owner', 1);
  world.bindInventory(host.playerId, store.inventory(account.accountId));
  for (let index = 0; index < 3; index++) world.manageCpu(host.playerId, 1, 'ADD', 1);
  world.ready(host.playerId, 1);
  let sequence = 0, immuneHits = 0, naturalHits = 0, casts = 0;
  const snapshot = () => world.snapshot(host.roomId)!;
  const local = () => snapshot().players.find(player => player.id === host.playerId)!;
  const cast = () => world.updateInput(host.playerId, {sequence: ++sequence, move: 0, turn: 0, aim: 0,
    fire: false, useItem: 5, clientTime: now});
  allow = false;
  assert(cast().some(event => event.type === 'itemRejected'));
  assert.equal(local().invincibility, undefined);
  assert.equal(world.inventory(host.playerId).records[0].ownedQuantity, 3);
  allow = true;
  const rounds = [];
  for (let round = 1; round <= 2; round++) {
    if (round === 2) world.rematch(host.playerId, 1);
    assert.equal(local().invincibility, undefined);
    let castAt = 0, expired = false, protectedHp = 0, roundImmuneHits = 0, hitsAfterExpiry = 0;
    // Normal stationary input allows CPUs to naturally target/injure the player.
    for (let tick = 0; tick < 6200 && snapshot().phase === 'PLAYING'; tick++) {
      const before = local();
      now += 50;
      const step = world.step(50);
      for (const event of step.events) {
        if (event.type === 'immuneHit' && event.targetId === host.playerId) {
          immuneHits++; roundImmuneHits++;
          assert.equal(local().hp, before.hp, 'Actual projectile collision must not change protected HP');
          assert.equal(local().hp, protectedHp);
        }
        if (event.type === 'hit' && event.targetId === host.playerId) {
          naturalHits++;
          if (castAt && now >= castAt + 10000) hitsAfterExpiry++;
        }
        if (event.stopSkillEffect?.skillId === 8 && event.playerId === host.playerId) {
          assert(now >= castAt + 10000); expired = true;
        }
      }
      if (!castAt && local().alive && local().hp < local().maxHp) {
        const used = cast().find(event => event.type === 'itemUsed')!;
        assert(used);
        assert.equal(used.playSkillEffect?.duration, 10);
        castAt = now; protectedHp = local().hp; casts++;
        assert.deepEqual(local().invincibility, {skillId: 8, expiresAt: now + 10000});
        assert(cast().some(event => event.type === 'itemRejected'));
      }
      if (castAt && now < castAt + 10000 && snapshot().phase === 'PLAYING') assert(local().invincibility);
      if (expired) assert.equal(local().invincibility, undefined);
    }
    assert(castAt > 0 && expired);
    assert(roundImmuneHits > 0, 'Each round must observe actual protected CPU projectile hits');
    assert(hitsAfterExpiry > 0, 'Each round must observe ordinary CPU damage after immunity expires');
    assert.equal(snapshot().phase, 'FINISHED');
    assert(snapshot().players.every(player => !player.invincibility));
    rounds.push({round, castAt, expired, roundImmuneHits, hitsAfterExpiry, result: snapshot().match!.result});
  }
  assert.equal(casts, 2); assert(immuneHits > 0 && naturalHits > 0);
  assert.equal(store.inventory(account.accountId).records[0].ownedQuantity, 1);
  world.leave(host.playerId);
  store.close(); store = new AccountStore(join(directory, 'accounts.sqlite'));
  assert.equal(store.inventory(account.accountId).records[0].ownedQuantity, 1);
  assert.equal(store.inventory(account.accountId).hotkeys[3], 77);
  writeFileSync('recovery/output/invincibility-world.json', JSON.stringify({status: 'PASS', casts, immuneHits,
    naturalHits, rounds, persisted: store.inventory(account.accountId),
    scope: 'Normal slot input/source10s, actual CPU projectile collision immunity and natural damage after expiry, two natural rounds/stock preservation, CAS refusal and store reopen. Authority/immunity policy rebuilt; no injected battle state or original damage formula.'}, null, 2));
  console.log('PASS: ordinary invincibility, actual natural CPU immune hits/expiry/damage, two rounds and persistent stock');
} finally {store.close(); rmSync(directory, {recursive: true, force: true});}
