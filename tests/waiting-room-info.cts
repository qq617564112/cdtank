import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {World} from '../apps/server/src/world';
import {MAPS} from '../apps/server/src/config';
import {waitingRoomInfo} from '../apps/web/src/interface/lobby/waiting-room-state';
const sourceRows = [1,2,3,4,5].flatMap(mode => {
  const table = JSON.parse(readFileSync(`recovery/output/verified/tables/m00${mode}.json`, 'utf8')) as {rows: {values: Record<string,string>}[]};
  return table.rows.map(row => ({mode, values: row.values}));
});
let clock = 100000;
const world = new World(() => clock);
const rows = [];
for (const map of MAPS) {
  const original = sourceRows.find(row => row.mode === map.mode && Number(row.values.MapID) === map.mapId)!.values;
  assert.equal(map.name, original.MapName); assert.equal(map.description, original.MapInfo);
  const owner = world.createAndJoin(`owner-${map.mode}-${map.mapId}`, map.mode, map.mapId,
    `资料-${map.mode}-${map.mapId}`, 'Owner', 1, 'never-publish-password');
  const snapshot = world.snapshot(owner.roomId)!;
  assert.deepEqual(snapshot.roomInfo, {name: world.listRooms().find(room => room.id === owner.roomId)!.name, mapId: map.mapId,
    mapName: original.MapName, mapDescription: original.MapInfo, timeLimitSeconds: Number(original.Time), hasPassword: true});
  assert.equal(snapshot.remaining, 0);
  assert.notEqual(waitingRoomInfo(snapshot).time, '0');
  const before = JSON.stringify(snapshot);
  snapshot.roomInfo!.name = 'tampered'; snapshot.roomInfo!.mapDescription = 'tampered';
  const refreshed = world.snapshot(owner.roomId)!;
  assert.equal(JSON.stringify(refreshed), before, 'metadata projection does not mutate authoritative state');
  assert.throws(() => world.joinRoom(owner.roomId, 'wrong', 'Wrong', 1, 'wrong'), /密码/);
  assert.equal(world.snapshot(owner.roomId)!.players.length, 1);
  const wire = JSON.stringify(refreshed);
  for (const forbidden of ['never-publish-password','passwordHash','passwordSalt']) assert(!wire.includes(forbidden));
  rows.push(refreshed.roomInfo);
  world.leave(owner.playerId);
}
const override = new World(() => clock, {timeLimitSeconds: 17});
const owner = override.createAndJoin('owner', 1, 7, '配置时长', 'Owner', 1);
const snapshot = override.snapshot(owner.roomId)!;
assert.equal(snapshot.roomInfo!.timeLimitSeconds, 17);
assert.notEqual(snapshot.roomInfo!.timeLimitSeconds, MAPS.find(map => map.mode === 1 && map.mapId === 7)!.timeLimit);
assert.equal(snapshot.roomInfo!.hasPassword, false);
const old = {...snapshot, remaining: 99, roomInfo: undefined};
assert.deepEqual(waitingRoomInfo(old), {name:'资料不可用',mapName:'资料不可用',time:'—',locked:false,description:'服务器未提供房间资料'});
const blank = {...snapshot, roomInfo: {...snapshot.roomInfo!, mapDescription:''}};
assert.equal(waitingRoomInfo(blank).description, '暂无地图说明');
const literal = {...snapshot,roomInfo:{...snapshot.roomInfo!,name:'<b>literal</b>',mapDescription:'<img src=x>说明'}};
assert.equal(waitingRoomInfo(literal).name,'<b>literal</b>');assert.equal(waitingRoomInfo(literal).description,'<img src=x>说明');
assert.equal(JSON.stringify(override.snapshot(owner.roomId)),JSON.stringify(snapshot));
writeFileSync('recovery/output/waiting-room-info-rules.json',JSON.stringify({status:'PASS',sourceRows:rows.length,rows,effectiveTimeOverride:17,oldSnapshotFallback:true,passwordSecretAbsent:true,noMutation:true},null,2));
console.log(`PASS: ${rows.length} original mode/map metadata, password rejection/no secrets, immutable projection, effective configured duration and older snapshot fallback`);
