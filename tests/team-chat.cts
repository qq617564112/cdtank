import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {World} from '../apps/server/src/world';
import {MAPS} from '../apps/server/src/config';
import {roomChat} from '../apps/server/src/rooms/chat';

for (const mode of [1, 2, 3, 4, 5]) {
  const world = new World(() => 1000);
  const map = MAPS.find(value => value.mode === mode)!;
  const joined = world.createAndJoin(`account-${mode}`, mode, map.mapId, '聊天', '玩家', 1);
  const before = world.snapshot(joined.roomId);
  const publicEvents = world.chat(joined.playerId, '  公共  ', 0);
  assert.equal(publicEvents[0].message, '玩家: 公共');
  assert.equal(publicEvents[0].value, 0);
  const events = world.chat(joined.playerId, '  队伍  ', 1);
  if (mode <= 3) {
    assert.equal(events.length, 1);
    assert.equal(events[0].message, '[队伍] 玩家: 队伍');
    assert.equal(events[0].value, 1);
  } else assert.deepEqual(events, []);
  for (const channel of [-1, 2, 3]) assert.deepEqual(world.chat(joined.playerId, '文本', channel), []);
  for (const text of ['', ' ', '\n伪造', '中'.repeat(73)]) {
    assert.deepEqual(world.chat(joined.playerId, text, 0), []);
    assert.deepEqual(world.chat(joined.playerId, text, 1), []);
  }
  assert.equal(world.chat(joined.playerId, '中'.repeat(72), 0).length, 1);
  assert.equal(world.chat(joined.playerId, '中'.repeat(72), 1).length, Number(mode <= 3));
  assert.deepEqual(world.chat('missing', '文本', 1), []);
  assert.deepEqual(world.snapshot(joined.roomId), before, 'Chat cannot mutate battle state');
  world.leave(joined.playerId);
  assert.deepEqual(world.chat(joined.playerId, '离开', 1), []);
}
assert.equal(roomChat('room', {id: 'p', name: '名字'}, '中文', 1)[0].message, '[队伍] 名字: 中文');
writeFileSync('recovery/output/team-chat-rules.json', JSON.stringify({status: 'PASS',
  modes: [1, 2, 3, 4, 5], teamModes: [1, 2, 3], personalModesRejected: [4, 5],
  channelsRejected: [-1, 2, 3], boundaryCharacters: 72,
  publicFormatting: '玩家: 公共', teamFormatting: '[队伍] 玩家: 队伍',
  stateUnchanged: true, absentAndDepartedRejected: true,
  scope: 'Normal World create/join/leave; team-mode authority, public baseline, text validation, no battle mutation.'}, null, 2));
console.log('PASS: team chat mode authority, public baseline, membership, 72-character validation, no battle mutation');
