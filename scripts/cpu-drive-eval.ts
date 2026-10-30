import {spawn} from 'node:child_process';
import {writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

// CPU-only team matches on a simulated clock, sampled every 500 ms like the
// room trace. `--root` points at another checkout to compare policies.
type Tank = {id: string; team: number; alive: boolean; deaths: number; x: number; y: number; z: number; yaw: number;
  bodyYaw?: number;
  input: {move: number; turn: number}; damageDealt: number; shots: number; hits: number;
  decision?: {driveSource?: string; targetId?: string; targetVisible?: boolean}};
interface Sample {at: number; tanks: Tank[];}
interface Point {at: number; x: number; y: number; z: number; deaths: number; move: number; turn: number;
  targetId?: string; visible?: boolean;}

const args = process.argv.slice(2);
const option = (name: string, fallback: string): string => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};
const root = resolve(option('root', '.'));

async function match(mapId: number, seconds: number): Promise<void> {
  process.chdir(root);
  const {World} = await import(pathToFileURL(`${root}/apps/server/src/world.ts`).href);
  let now = Date.UTC(2026, 0, 1);
  const roomId = `E${mapId}`;
  const world = new World(() => now, {allocateRoomId: () => roomId});
  const map = world.listMaps().find((value: {mode: number; mapId: number}) => value.mode === 1 && value.mapId === mapId);
  if (!map) throw new Error(`Unknown team map ${mapId}`);
  world.createCpuRoom(1, mapId, roomId, Math.min(12, map.maxPlayers), seconds);
  const steps: number[] = [];
  const samples: Sample[] = [];
  // Rendered hull rotation per 50 ms tick: direction changes, and changes back within one second.
  const hulls = new Map<string, {yaw: number; deaths: number; direction: number; changedAt: number}>();
  const swing = {aliveTicks: 0, hullChanges: 0, hullSwings: 0};
  for (let tick = 0; tick < (seconds + 60) * 20; tick++) {
    const started = performance.now();
    const result = world.step(50);
    steps.push(performance.now() - started);
    const trace = world.cpuTrace(roomId);
    now += 50;
    if (trace && tick % 10 === 0) samples.push({at: trace.at, tanks: trace.tanks});
    for (const tank of (trace?.tanks ?? []) as Tank[]) {
      const hull = hulls.get(tank.id);
      const yaw = tank.bodyYaw ?? tank.yaw;
      if (!tank.alive || !hull || hull.deaths !== tank.deaths) {
        hulls.set(tank.id, {yaw, deaths: tank.deaths, direction: 0, changedAt: Number.NEGATIVE_INFINITY});
        continue;
      }
      swing.aliveTicks++;
      const delta = Math.atan2(Math.sin(yaw - hull.yaw), Math.cos(yaw - hull.yaw));
      hull.yaw = yaw;
      if (Math.abs(delta) < 1e-4) continue;
      const direction = Math.sign(delta);
      if (hull.direction !== 0 && direction !== hull.direction) {
        swing.hullChanges++;
        if (now - hull.changedAt <= 1000) swing.hullSwings++;
        hull.changedAt = now;
      }
      hull.direction = direction;
    }
    if (result.snapshots[0]?.phase === 'FINISHED') break;
  }
  const sorted = [...steps].sort((a, b) => a - b);
  process.stdout.write(`${JSON.stringify({mapId, name: map.name, metrics: {...metrics(samples), ...swing},
    timing: {mean: steps.reduce((a, b) => a + b, 0) / steps.length, p99: sorted[Math.floor(sorted.length * .99)],
      max: sorted.at(-1), over50: steps.filter(value => value > 50).length}})}\n`);
}

function metrics(samples: Sample[]) {
  const flat = (a: {x: number; z: number}, b: {x: number; z: number}) => Math.hypot(a.x - b.x, a.z - b.z);
  const result = {aliveSeconds: 0, pairs: 0, reversals: 0, turnPairs: 0, turnReversals: 0, moving: 0,
    reversing: 0, longestReverse: 0, reversesOver4: 0, stuck: 0, idle: 0, crowd: 0, oscillation: 0,
    travel: 0, deaths: 0, damage: 0, shots: 0, hits: 0, reverseBySource: {} as Record<string, number>};
  const histories = new Map<string, Point[]>();
  const streaks = new Map<string, number>();
  const closeStreak = (id: string): void => {
    const streak = streaks.get(id) ?? 0;
    result.longestReverse = Math.max(result.longestReverse, streak);
    if (streak > 4) result.reversesOver4++;
    streaks.set(id, 0);
  };
  for (const sample of samples) {
    for (const tank of sample.tanks) {
      let history = histories.get(tank.id) ?? [];
      const last = history.at(-1);
      if (!tank.alive || last && (last.deaths !== tank.deaths || sample.at - last.at > 1500)) {
        history = [];
        closeStreak(tank.id);
      }
      histories.set(tank.id, history);
      if (!tank.alive) continue;
      const item: Point = {at: sample.at, x: tank.x, y: tank.y, z: tank.z, deaths: tank.deaths,
        move: Math.sign(tank.input.move), turn: Math.sign(tank.input.turn),
        targetId: tank.decision?.targetId, visible: tank.decision?.targetVisible};
      history.push(item);
      if (history.length > 10) history.shift();
      result.aliveSeconds += .5;
      if (item.move !== 0) result.moving++;
      if (item.move < 0) {
        result.reversing++;
        const source = tank.decision?.driveSource ?? 'NONE';
        result.reverseBySource[source] = (result.reverseBySource[source] ?? 0) + 1;
        streaks.set(tank.id, (streaks.get(tank.id) ?? 0) + .5);
      } else closeStreak(tank.id);
      const previous = history.at(-2);
      if (!previous) continue;
      result.travel += flat(item, previous);
      if (previous.move !== 0) {result.pairs++; if (item.move === -previous.move) result.reversals++;}
      if (previous.turn !== 0) {result.turnPairs++; if (item.turn === -previous.turn) result.turnReversals++;}
      const before = history.at(-3);
      if (!before) continue;
      const moved = flat(item, before);
      // One second of held movement keys without displacement.
      if (item.move !== 0 && previous.move !== 0 && moved < 4) result.stuck += .5;
      // One second without keys while the target is out of sight.
      if (item.targetId && !item.visible && item.move === 0 && item.turn === 0
          && previous.move === 0 && previous.turn === 0 && moved < 4) result.idle += .5;
      if (moved < 4 && sample.tanks.some(other => other.alive && other.id !== tank.id
        && other.team === tank.team && Math.abs(other.y - tank.y) < 24 && flat(other, tank) < 80)) result.crowd += .5;
      // Five seconds with four or more direction flips but under 30 units of net travel.
      if (history.length === 10) {
        let flips = 0;
        for (let index = 1; index < history.length; index++) {
          if (history[index].move !== 0 && history[index].move === -history[index - 1].move) flips++;
        }
        if (flips >= 4 && flat(history[0], item) < 30) result.oscillation += .5;
      }
    }
  }
  for (const tank of samples.at(-1)?.tanks ?? []) {
    result.deaths += tank.deaths; result.damage += tank.damageDealt;
    result.shots += tank.shots; result.hits += tank.hits;
  }
  return result;
}

async function batch(maps: number[], seconds: number, concurrency: number, output?: string): Promise<void> {
  const results: {mapId: number; metrics: ReturnType<typeof metrics> & {aliveTicks: number; hullChanges: number; hullSwings: number};
    timing: {mean: number; p99: number; max: number; over50: number}}[] = [];
  let next = 0;
  await Promise.all(Array.from({length: concurrency}, async () => {
    while (next < maps.length) {
      const mapId = maps[next++];
      const text = await new Promise<string>((done, reject) => {
        let out = '';
        const child = spawn(process.execPath, ['--import', 'tsx', import.meta.filename, 'match', String(mapId),
          String(seconds), '--root', root], {cwd: root, stdio: ['ignore', 'pipe', 'inherit']});
        child.stdout.on('data', chunk => {out += chunk;});
        child.on('exit', code => code === 0 ? done(out) : reject(new Error(`Map ${mapId} exited ${code}`)));
      });
      results.push(JSON.parse(text.trim().split('\n').filter(line => line.startsWith('{')).at(-1)!));
    }
  }));
  results.sort((a, b) => a.mapId - b.mapId);
  if (output) await writeFile(output, `${JSON.stringify(results, null, 2)}\n`);
  type Totals = Omit<(typeof results)[number]['metrics'], 'reverseBySource'>;
  const sum = (key: keyof Totals) => results.reduce((total, row) => total + row.metrics[key], 0);
  const minutes = sum('aliveSeconds') / 60;
  const rate = (key: keyof Totals) => Number((sum(key) / minutes).toFixed(2));
  const percent = (part: number, whole: number) => Number((part / Math.max(1, whole) * 100).toFixed(1));
  console.log(JSON.stringify({root, maps, seconds,
    moveReversalPercent: percent(sum('reversals'), sum('pairs')),
    turnReversalPercent: percent(sum('turnReversals'), sum('turnPairs')),
    reverseSharePercent: percent(sum('reversing'), sum('moving')),
    longestReverseSeconds: Math.max(...results.map(row => row.metrics.longestReverse)),
    reversesOver4PerTankHour: Number((sum('reversesOver4') / minutes * 60).toFixed(1)),
    stuckSecondsPerTankMinute: rate('stuck'), idleSecondsPerTankMinute: rate('idle'),
    crowdSecondsPerTankMinute: rate('crowd'), oscillationSecondsPerTankMinute: rate('oscillation'),
    travelPerTankMinute: rate('travel'), deathsPerTankMinute: rate('deaths'), damagePerTankMinute: rate('damage'),
    hitPercent: percent(sum('hits'), sum('shots')),
    hullChangesPerTankMinute: Number((sum('hullChanges') / Math.max(1, sum('aliveTicks') / 1200)).toFixed(2)),
    hullSwingsPerTankMinute: Number((sum('hullSwings') / Math.max(1, sum('aliveTicks') / 1200)).toFixed(2)),
    tickMeanMs: Number((results.reduce((total, row) => total + row.timing.mean, 0) / results.length).toFixed(2)),
    tickP99Ms: Number(Math.max(...results.map(row => row.timing.p99)).toFixed(1)),
    ticksOver50: results.reduce((total, row) => total + row.timing.over50, 0)}, null, 2));
}

if (args[0] === 'match') await match(Number(args[1]), Number(args[2]));
else {
  const maps = option('maps', '3,19,8,9,15,17,2,6').split(',').map(Number);
  await batch(maps, Number(option('seconds', '300')), Number(option('concurrency', '3')), args.includes('--output')
    ? resolve(option('output', 'cpu-drive-eval.json')) : undefined);
}
