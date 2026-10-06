import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {WsClient, WsServer} from 'tsrpc';
import {serviceProto} from '../apps/shared/protocols/serviceProto';
import type {MsgRoomEvent} from '../apps/shared/protocols/MsgRoomEvent';
import {BattleSkillEffects, battleRoleId} from '../apps/web/src/match/skills/battle-skill-effects';
import {SkillEffectNotifications} from '../apps/web/src/match/skills/skill-effect-notifications';

async function main(): Promise<void> {
  const callbacks: object[] = [];
  const roles = new Set([47]);
  let handle = 0;
  const notifications = new SkillEffectNotifications<number, number, number>({
    skill: () => ({effects: [{effectId: 4, tag: 0, sound: 'GA35'}]}),
    role: id => roles.has(id) ? id : undefined,
    hasActor: () => true,
    world: (name, position) => {callbacks.push({kind: 'world', name, position});},
    attached: role => {callbacks.push({kind: 'attached', role}); return ++handle;},
    sound: () => ++handle,
    stopEffect: effect => {callbacks.push({kind: 'stopEffect', effect});},
    stopSound: sound => {callbacks.push({kind: 'stopSound', sound});},
    release: () => {},
    resetRoleEffects: role => {callbacks.push({kind: 'reset', role});},
  });
  const battle = new BattleSkillEffects(notifications);
  let frameTime = 0;
  const frame = (delta: number) => {frameTime += delta; battle.frame(delta, frameTime);};
  assert.equal(battleRoleId('P47'), 47);
  const server = new WsServer(serviceProto, {port: 3128, logLevel: 'error'});
  const client = new WsClient(serviceProto, {server: 'ws://127.0.0.1:3128', logger: undefined});
  let received = 0;
  client.listenMsg('RoomEvent', event => {battle.event(event); received++;});
  async function send(fields: Partial<MsgRoomEvent>): Promise<void> {
    const expected = received + 1;
    const result = await server.broadcastMsg('RoomEvent', {roomId: 'R1', type: 'skillEffect',
      message: '', playerId: 'P47', targetId: '', value: 0, x: 0, y: 0, z: 0, ...fields});
    assert(result.isSucc);
    const deadline = Date.now() + 3000;
    while (received < expected && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 5));
    assert.equal(received, expected);
  }
  const play = (skillId: number, duration = 2) => ({skillId, duration, effectIndex: 0,
    roleId: 47, xBits: 0, zBits: 0});
  try {
    await server.start();
    assert((await client.connect()).isSucc);
    await send({playSkillEffect: play(8)});
    assert.equal(notifications.records.length, 1);
    for (let index = 0; index < 60; index++) frame(1 / 60);
    assert.equal(notifications.records[0].duration, 1);
    await send({stopSkillEffect: {skillId: 8, roleId: 47}});
    assert.equal(notifications.records.length, 0);
    await send({playSkillEffect: play(13501)});
    await send({playSkillEffect: play(13502)});
    battle.revive('P47');
    assert.equal(notifications.queueTimers.size, 1);
    frame(5);
    assert.equal(notifications.queueTimers.get(47)!.remaining, 0);
    frame(.01);
    assert.equal(notifications.queueTimers.get(47)!.skillId, 13502);
    battle.remove('P47');
    assert.equal(notifications.queues.size, 0);
    assert.equal(notifications.queueTimers.size, 0);
    await send({playSkillEffect: play(8)});
    battle.clear();
    assert.equal(notifications.records.length, 0);
    const beforeResetFrame = notifications.updateAccumulator;
    frame(1 / 60);
    assert.equal(notifications.updateAccumulator, beforeResetFrame + 1);
    // Reconstructing the clock preserves the original notification accumulator.
    await send({playSkillEffect: {...play(8), roleId: 0, xBits: 0x41480000, zBits: 0xc0800000}});
    assert.deepEqual(callbacks.at(-1), {kind: 'world', name: '_root\\online\\004', position: [12.5, 0, -4]});
    roles.delete(47);
    const before = callbacks.length;
    await send({playSkillEffect: play(8)});
    assert.equal(callbacks.length, before);
    writeFileSync('recovery/output/battle-skill-effects.json', JSON.stringify({status: 'PASS',
      scope: 'Real TSRPC server notifications to battle coordinator; original notification state. Test server supplies messages, not inventory-authorized gameplay or browser pixels.',
      received, callbacks}, null, 2));
    console.log('PASS: TSRPC Play/Stop, native frame scheduler countdown, revive queue, role removal and round cleanup');
  } finally {
    await client.disconnect();
    await server.stop();
  }
}
main().catch(error => {console.error(error); process.exitCode = 1;});
