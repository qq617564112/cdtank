import type {RoomProcesses} from './room-processes';
import type {roomTransport} from '../rooms/transport';

/** Preserve fixed simulation delta and snapshot-before-event wire ordering. */
export function startWorldTicks(world: RoomProcesses, tickRate: number,
  transport: ReturnType<typeof roomTransport>, retryWrites?: () => void): ReturnType<typeof setInterval> {
  const deltaMs = 1000 / tickRate;
  world.onTick((snapshot, events) => {
    transport.broadcastSnapshot(snapshot);
    for (const event of events) transport.broadcastEvent(event);
  });
  return setInterval(() => retryWrites?.(), deltaMs);
}
