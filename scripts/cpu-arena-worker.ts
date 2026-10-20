import {mkdir, writeFile} from 'node:fs/promises';
import {join, resolve} from 'node:path';
import {World} from '../apps/server/src/world';
import {CpuTraceRecorder} from '../apps/server/src/runtime/cpu-trace';
import type {CommittedMatch} from '../apps/server/src/settlement/history';

const directory = resolve(process.argv[2]);
const mapId = Number(process.argv[3]);
const roomId = process.argv[4];
process.env.CPU_TRACE_DIR = directory;
await mkdir(directory, {recursive: true});
let settlement: CommittedMatch | undefined;
const world = new World(Date.now, {allocateRoomId: () => roomId,
  onMatchCommitted: match => {settlement = match;}});
const map = world.listMaps().find(value => value.mode === 1 && value.mapId === mapId);
if (!map) throw new Error(`Unknown team map ${mapId}`);
const players = Math.min(12, map.maxPlayers);
world.createCpuRoom(1, mapId, roomId, players, 300);
const recorder = new CpuTraceRecorder(roomId, 50);
await writeFile(join(directory, 'started.json'), JSON.stringify({roomId, mapId, mapName: map.name,
  pid: process.pid, startedAt: Date.now(), players, timeLimitSeconds: 300}, null, 2) + '\n');
let stopping = false;
const combatEvents: {at: number; type: string; playerId: string; targetId: string;
  value: number; x: number; y: number; z: number; skillId?: number}[] = [];
const timer = setInterval(() => {
  if (stopping) return;
  try {
    const tickAt = performance.now();
    const result = world.step(50);
    for (const event of result.events) {
      if (!['hit', 'immuneHit', 'fire', 'destroy', 'respawn'].includes(event.type)) continue;
      combatEvents.push({at: Date.now(), type: event.type, playerId: event.playerId,
        targetId: event.targetId, value: event.value, x: event.x, y: event.y, z: event.z,
        skillId: event.skillId});
    }
    recorder.record(tickAt, performance.now() - tickAt, () => world.cpuTrace(roomId));
    const snapshot = result.snapshots[0];
    if (snapshot?.phase !== 'FINISHED') return;
    stopping = true;
    clearInterval(timer);
    void (async () => {
      await recorder.close();
      await writeFile(join(directory, 'combat-events.json'), JSON.stringify(combatEvents) + '\n');
      if (!settlement || settlement.participants.some(player => !player.cpu)) {
        throw new Error('Expected a normally settled CPU-only match');
      }
      await writeFile(join(directory, 'settlement.json'), JSON.stringify(settlement, null, 2) + '\n');
      await writeFile(join(directory, 'finished.json'), JSON.stringify({roomId, mapId,
        endedAt: settlement.result.endedAt, reason: settlement.result.reason,
        players: settlement.participants.length, pid: process.pid}, null, 2) + '\n');
    })().catch(error => {console.error(error); process.exitCode = 1;});
  } catch (error) {
    stopping = true;
    clearInterval(timer);
    console.error(error);
    void recorder.close().finally(() => {process.exitCode = 1;});
  }
}, 50);
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, () => {
    stopping = true;
    clearInterval(timer);
    void recorder.close().finally(() => process.exit(1));
  });
}
