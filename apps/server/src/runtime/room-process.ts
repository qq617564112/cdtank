import {World} from '../world';
import {callRoomService} from './room-services';
import type {RoomInit, RoomMessage, RoomRequest, RoomStatePublication} from './room-protocol';
import type {RoomCommand} from '../rooms/world-interface';

let world: World;
let roomId: string;
let timer: ReturnType<typeof setInterval> | undefined;
const identities = new Map<string, string>();
const outgoing: RoomMessage[] = [];
let sending = false;
const READ_COMMANDS = new Set<RoomCommand>([
  'exitPenaltyCount', 'playerInputSequence', 'inventory', 'canConfigureInventory',
]);

/** Preserve publication order; read replies can pass unsent ticks without changing state. */
function send(message: RoomMessage, prioritize = false): void {
  const last = outgoing[outgoing.length - 1];
  if (message.type === 'tick' && last?.type === 'tick') {
    last.state = message.state;
    last.events.push(...message.events);
  } else if (prioritize) {
    let position = outgoing.length;
    while (position > 0 && outgoing[position - 1].type === 'tick') position--;
    outgoing.splice(position, 0, message);
  } else outgoing.push(message);
  flush();
}

function flush(): void {
  if (sending || !outgoing.length || !process.connected) return;
  sending = true;
  process.send!(outgoing.shift()!, (error: Error | null) => {
    sending = false;
    if (error) {stop(); return;}
    flush();
  });
}

function stop(): void {
  if (timer) clearInterval(timer);
  process.exit(0);
}

function state(): RoomStatePublication {
  return {snapshot: world.snapshot(roomId), summary: world.listRooms()[0]};
}

process.on('disconnect', stop);
process.on('message', (message: RoomInit | RoomRequest) => {
  if (message.type === 'init') {
    roomId = message.roomId;
    process.title = `cdtank-room-${roomId}`;
    world = new World(Date.now, {...message.options,
      allocateRoomId: () => roomId,
      allocatePlayerId: () => callRoomService('allocatePlayerId'),
      resolveAccount: connectionId => identities.get(connectionId),
      currentTitle: accountId => callRoomService('currentTitle', accountId),
      consumeItem: (...args) => callRoomService('consumeItem', ...args),
      acquireOwnedItem: (...args) => callRoomService('acquireOwnedItem', ...args),
      discardOwnedItem: (...args) => callRoomService('discardOwnedItem', ...args),
      onMatchCommitted: match => callRoomService('commitMatch', {...match,
        participants: match.participants.map(participant => ({...participant,
          accountId: participant.accountId ?? identities.get(participant.connectionId)}))}),
      onInventoryRecord: (accountId, record) => callRoomService('inventoryRecord', accountId, record),
    });
    const deltaMs = 1000 / message.tickRate;
    timer = setInterval(() => {
      const result = world.step(deltaMs);
      if (result.snapshots.length) {
        send({type: 'tick', state: {snapshot: result.snapshots[0], summary: world.listRooms()[0]},
          events: result.events});
      }
    }, deltaMs);
    send({type: 'ready'});
    return;
  }
  if (message.identity) identities.set(message.identity.connectionId, message.identity.accountId);
  const readOnly = READ_COMMANDS.has(message.method);
  try {
    const result: unknown = Reflect.apply(world[message.method], world, message.args);
    // Ordinary input acknowledgements need no extra full-room snapshot between ticks.
    const publish = !readOnly && (message.method !== 'updateInput'
      || (result as ReturnType<World['updateInput']>)
        .some(event => event.roleStyleChanged || event.roleStyleRestored));
    send({type: 'reply', id: message.id, result, state: publish ? state() : undefined}, readOnly);
  } catch (error) {
    send({type: 'reply', id: message.id,
      error: error instanceof Error ? error.message : String(error),
      state: readOnly ? undefined : state()}, readOnly);
  }
});
