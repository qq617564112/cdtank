import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {createSceneObjects, damageSceneObject} from '../apps/server/src/battle/environment';
import {getSceneCastles} from '../apps/server/src/scene-objects';
import type {MsgRoomEvent} from '../apps/shared/protocols';

const mapIds = [2, 5, 6, 10, 11];
let refusals = 0;
for (const mapId of mapIds) {
  const sources = getSceneCastles(mapId);
  const objects = createSceneObjects({mode: 1, map: {mapId}});
  assert.equal(objects.length, 2);
  for (const [index, object] of objects.entries()) {
    const source = sources[index];
    assert.equal(object.id, `CASTLE:${source.id}`);
    assert.equal(object.hp, source.hp);
    assert.equal(object.maxHp, source.hp);
    const events: MsgRoomEvent[] = [];
    const room = {roomId: 'rule-scope', phase: 'WAITING'};
    const owner = {id: 'owner', name: 'Owner'};
    damageSceneObject(room, owner, object, 43, 100, events);
    assert.equal(object.hp, source.hp);
    assert.equal(events.length, 0);
    refusals++;
    room.phase = 'PLAYING';
    for (const damage of [0, -1, NaN, Infinity]) {
      damageSceneObject(room, owner, object, damage, 100, events);
      assert.equal(object.hp, source.hp);
      assert.equal(events.length, 0);
      refusals++;
    }
    damageSceneObject(room, owner, object, 43, 100, events);
    assert.deepEqual(events[0].castleDamage, {castleId: source.id,
      currentHP: source.hp - 43, maxHP: source.hp, delta: 43});
    assert.equal(events.length, 1);
    damageSceneObject(room, owner, object, source.hp, 200, events);
    assert.equal(object.hp, 0);
    assert.equal(events.length, 3);
    assert.equal(events[1].castleDamage!.delta, source.hp - 43);
    damageSceneObject(room, owner, object, 43, 300, events);
    assert.equal(events.length, 3);
    refusals++;
  }
  assert.equal(createSceneObjects({mode: 4, map: {mapId}}).length, 0);
}
writeFileSync('recovery/output/castle-authority.json', JSON.stringify({
  status: 'PASS_RULE_SCOPE_ONLY', maps: mapIds, castles: mapIds.length * 2, refusals,
  scope: 'Original CAS identity/initial HP and rebuilt damage transaction guards; direct rule calls, no gameplay evidence.'
}, null, 2) + '\n');
console.log(`PASS rule scope: ${mapIds.length * 2} original Castle identities/HP, ${refusals} rejected transactions`);
