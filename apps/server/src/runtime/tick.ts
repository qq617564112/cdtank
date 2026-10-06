import type {World} from '../world';
import type {roomTransport} from '../rooms/transport';

/** Preserve fixed simulation delta and snapshot-before-event wire ordering. */
export function startWorldTicks(world: World, tickRate: number,
  transport: ReturnType<typeof roomTransport>, retryWrites?: () => void): ReturnType<typeof setInterval> {
  const deltaMs = 1000 / tickRate;
  return setInterval(() => {
    retryWrites?.();
    const {snapshots, events} = world.step(deltaMs);
    for (const snapshot of snapshots) transport.broadcastSnapshot(snapshot);
    for (const event of events) transport.broadcastEvent(event);
  }, deltaMs);
}
