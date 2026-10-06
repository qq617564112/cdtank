import assert from 'node:assert/strict';
import type {WsClient} from 'tsrpc-browser';
import type {ServiceType} from '../apps/shared/protocols/serviceProto';
import type {MsgRoomSnapshot} from '../apps/shared/protocols/MsgRoomSnapshot';
import type {MsgRoomEvent} from '../apps/shared/protocols/MsgRoomEvent';
import {RoomFeed} from '../apps/web/src/match/room-feed';

const handlers = new Map<string, (message: unknown) => void>();
const client = {listenMsg: (name: string, handler: (message: unknown) => void) => {handlers.set(name, handler);}} as unknown as WsClient<ServiceType>;
const stages: string[] = [];
const accepted: MsgRoomSnapshot[] = [];
const previousStates: Array<MsgRoomSnapshot | undefined> = [];
const events: Array<{event: MsgRoomEvent; snapshot: MsgRoomSnapshot | undefined}> = [];
let previousTime = 0;
const feed = new RoomFeed(client, {
  beforeSnapshot: (next, previous) => {
    assert.equal(feed.snapshot, previous, 'Transition cleanup reads the previous committed state');
    assert.equal(feed.receivedAt, previousTime, 'Timestamp commits after transition cleanup');
    stages.push(`before:${next.tick}`);
    previousStates.push(previous);
  },
  snapshot: next => {
    assert.equal(feed.snapshot, next, 'Reconcile receives the newly committed state');
    assert(feed.receivedAt >= previousTime);
    previousTime = feed.receivedAt;
    stages.push(`snapshot:${next.tick}`);
    accepted.push(next);
  },
  event: (event, snapshot) => {
    assert.equal(snapshot, feed.snapshot);
    stages.push(`event:${event.type}`);
    events.push({event, snapshot});
  },
});
function snapshot(roomId: string, tick: number, round: number, phase: string): MsgRoomSnapshot {
  return {roomId, tick, mode: 4, serverTime: tick / 20, remaining: 300, phase,
    players: [], bullets: [], teamScores: [0, 0], winnerTeam: -1,
    match: {round, readyPlayerIds: [], rematchPlayerIds: [], minPlayers: 1,
      targetScore: 10, teamLives: [], objectives: []}};
}
function event(roomId: string, type = 'fire'): MsgRoomEvent {
  return {roomId, type, message: 'message', playerId: 'P1', targetId: '', value: 0, x: 1, y: 2, z: 3};
}
const receiveSnapshot = handlers.get('RoomSnapshot')!;
const receiveEvent = handlers.get('RoomEvent')!;
assert.equal(handlers.size, 2);
receiveSnapshot(snapshot('R1', 1, 1, 'WAITING'));
receiveEvent(event('R1'));
assert.deepEqual(stages, []);
feed.enter('R1');
const early = event('R1', 'chat');
receiveEvent(early);
assert.deepEqual(events[0], {event: early, snapshot: undefined});
const first = snapshot('R1', 2, 1, 'WAITING');
receiveSnapshot(first);
const playing = snapshot('R1', 3, 1, 'PLAYING');
receiveSnapshot(playing);
const finished = snapshot('R1', 4, 1, 'FINISHED');
receiveSnapshot(finished);
const repeated = snapshot('R1', 5, 1, 'FINISHED');
receiveSnapshot(repeated);
const rematch = snapshot('R1', 6, 2, 'WAITING');
receiveSnapshot(rematch);
assert.deepEqual(previousStates, [undefined, first, playing, finished, repeated]);
assert.deepEqual(stages, ['event:chat', 'before:2', 'snapshot:2', 'before:3', 'snapshot:3',
  'before:4', 'snapshot:4', 'before:5', 'snapshot:5', 'before:6', 'snapshot:6']);
receiveEvent(event('R1'));
assert.equal(events.at(-1)!.snapshot, rematch);
const count = stages.length;
const timestamp = feed.receivedAt;
receiveSnapshot(snapshot('R2', 7, 1, 'PLAYING'));
receiveEvent(event('R2'));
assert.equal(stages.length, count);
assert.equal(feed.snapshot, rematch);
assert.equal(feed.receivedAt, timestamp);
feed.enter('R1');
assert.equal(feed.snapshot, rematch);
feed.clear();
assert.equal(feed.roomId, undefined);
assert.equal(feed.snapshot, undefined);
assert.equal(feed.receivedAt, 0);
receiveSnapshot(first);
receiveEvent(early);
assert.equal(stages.length, count);
feed.enter('R2');
previousTime = 0;
const secondRoom = snapshot('R2', 8, 1, 'WAITING');
receiveSnapshot(first);
receiveSnapshot(secondRoom);
assert.equal(feed.snapshot, secondRoom);
assert.equal(previousStates.at(-1), undefined);
feed.enter('R3');
assert.equal(feed.roomId, 'R3');
assert.equal(feed.snapshot, undefined);
assert.equal(feed.receivedAt, 0);
assert.equal(accepted.length, 6);
console.log('PASS: active room isolation, single accepted snapshot, before/after commit ordering, event context, finish/rematch continuity and exit/re-entry');
