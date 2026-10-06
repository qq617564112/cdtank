import assert from 'node:assert/strict';
import {copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {AccountStore} from '../apps/server/src/account-store';
import {combatCatalog} from '../apps/server/src/battle/catalog';
import {World} from '../apps/server/src/world';

const source = 'recovery/output/pet-back-critical-network-2026-10-06T00-14-02-485Z';
const directory = mkdtempSync(join(tmpdir(), 'cdtank-last-stand-world-'));
const database = join(directory, 'accounts.sqlite');
copyFileSync(source + '-checkpoint.sqlite', database);
const accountId = JSON.parse(readFileSync(source + '-identity.private.json', 'utf8')).accounts[0].accountId as string;
const fixture = new DatabaseSync(database);
const row = fixture.prepare('SELECT payload FROM role_profiles WHERE account_id=?').get(accountId)!;
const bytes = Uint8Array.from(row.payload as Uint8Array);
new DataView(bytes.buffer).setUint32(0x80, 200, true);
fixture.prepare('UPDATE role_profiles SET payload=? WHERE account_id=?').run(bytes, accountId);
fixture.close();
const store = new AccountStore(database);
try {
  const purchase = store.petShop(accountId, {operation: 'BUY', petId: 4, currency: 'MONEY', requestId: 'last-stand-world-buy'});
  assert(purchase.purchased);
  const instanceId = new Map(purchase.purchased.fields).get(0)!;
  store.selectRole(accountId, 'pet', instanceId);
  const learned = store.petSkillLearning(accountId, {operation: 'LEARN', slot: 3,
    instanceId, requestId: 'last-stand-world-learn'}, combatCatalog);
  assert.equal(learned.learned!.skillId, 10441);
  let now = 100000;
  const world = new World(() => now);
  const joined = world.createAndJoin('last-stand-world', 4, 7, '最后一搏', 'Owner', 3);
  world.bindInventory(joined.playerId, store.inventory(accountId));
  world.bindRoleSources(joined.playerId, store.selectedRoleSources(accountId));
  world.bindEquipmentProfile(joined.playerId, store.roleProfile(accountId));
  const cpuId = world.manageCpu(joined.playerId, 1, 'ADD', 1);
  world.ready(joined.playerId, 1);
  assert.equal(world.roleAttributes(joined.playerId).ready, true);
  let began: number | undefined, ended: number | undefined, respawned: number | undefined;
  let destroys = 0, pendingTicks = 0, pendingFires = 0, pendingTurned = false;
  let initialAim = 0, initialYaw = 0;
  const input = {sequence: 1, move: 1, turn: 1, aim: 1, fire: true, useItem: 0, clientTime: 0};
  const stages: object[] = [];
  for (let tick = 0; tick < 6000 && respawned === undefined; tick++) {
    now += 50;
    const step = world.step(50);
    const snapshot = world.snapshot(joined.roomId)!;
    const player = snapshot.players.find(p => p.id === joined.playerId)!;
    if (player.hp === 0 && player.alive) {
      if (began === undefined) {
        began = now; initialAim = player.aim; initialYaw = player.yaw;
        stages.push({kind: 'pending', now, player}); world.updateInput(joined.playerId, input);
      }
      if (now - began === 200) world.updateInput(joined.playerId,
        {...input, sequence: 2, move: 0, turn: 0, aim: 0, fire: false});
      if (player.aim !== initialAim && player.yaw !== initialYaw) pendingTurned = true;
      pendingTicks++;
      assert.equal(player.deaths, 0); assert.equal(player.respawnAt, 0);
      assert(now - began < 3000);
    }
    for (const event of step.events) {
      if (event.type === 'fire' && event.playerId === joined.playerId && began !== undefined && ended === undefined) pendingFires++;
      if (event.type === 'destroy' && event.targetId === joined.playerId) {
        destroys++; assert(began !== undefined); assert.equal(now - began, 3000);
        ended = now; stages.push({kind: 'destroy', now, event, player});
        assert.equal(player.deaths, 1); assert.equal(player.alive, false);
        assert.equal(player.respawnAt, now + 3000);
      }
      if (event.type === 'respawn' && event.playerId === joined.playerId) {
        assert(ended !== undefined); assert.equal(now - ended, 3000);
        respawned = now; stages.push({kind: 'respawn', now, event, player});
        assert.equal(player.alive, true); assert.equal(player.hp, player.maxHp);
        assert.equal(player.reload!.startedAt, 0); assert.equal(player.ammoMagazine!.remaining, player.ammoMagazine!.capacity);
      }
    }
    assert.equal(snapshot.phase, 'PLAYING');
  }
  assert(began !== undefined && ended !== undefined && respawned !== undefined);
  assert.equal(destroys, 1); assert.equal(pendingTicks, 60);
  assert(pendingFires > 0 && pendingTurned);
  let secondPending = false;
  for (let tick = 0; tick < 6000 && !secondPending; tick++) {
    now += 50; world.step(50);
    const player = world.snapshot(joined.roomId)!.players.find(p => p.id === joined.playerId)!;
    secondPending = player.hp === 0 && player.alive;
  }
  assert(secondPending);
  world.leave(cpuId);
  assert.equal(world.snapshot(joined.roomId)!.phase, 'FINISHED');
  now += 4000;
  assert(!world.step(4000).events.some(e => e.type === 'destroy'));
  world.rematch(joined.playerId, 1);
  const renewed = world.snapshot(joined.roomId)!;
  assert.equal(renewed.phase, 'PLAYING');
  assert.equal(renewed.players[0].hp, renewed.players[0].maxHp);
  world.leave(joined.playerId); assert.equal(world.snapshot(joined.roomId), undefined);
  writeFileSync('recovery/output/last-stand-world.json', JSON.stringify({
    status: 'PASS_LEARNED_PET4_LAST_STAND_WORLD_NATURAL_LETHAL_FIXED3000_FINAL_DEATH_RESPAWN_SCOPE',
    fixture: 'Copied legal checkpoint; pre-service non-earned Point200; ordinary AccountStore BUY4/Select/LEARN; idle human owner and one ordinary CPU, no active state injection',
    source: source + '-checkpoint.sqlite', simulationTickSeconds: .05, realtimeNetworkProved: false,
    began, ended, respawned, pendingTicks, destroys, pendingFires, pendingTurned,
    pendingFinishCancelsDeath: true, rematchRestoresHealth: true, stages, leaveRemovedRoom: true,
  }, null, 2) + '\n');
  console.log('PASS last stand World natural death, sixty live HP0 ticks, final death and respawn');
} finally {store.close(); rmSync(directory, {recursive: true, force: true});}
