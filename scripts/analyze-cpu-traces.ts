import {createReadStream} from 'node:fs';
import {writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createInterface} from 'node:readline';
import type {CpuTraceRecord} from '../apps/server/src/runtime/cpu-trace';

type Tank = CpuTraceRecord['tanks'][number];
type IssueKind = 'movement-stalled' | 'idle-with-target' | 'teammate-congestion'
  | 'drive-oscillation' | 'target-churn';

interface Observation {
  at: number;
  tank: Tank;
  teammates: string[];
}

interface Episode {
  kind: IssueKind;
  playerId: string;
  from: number;
  to: number;
  seconds: number;
  fromBattleSeconds: number;
  toBattleSeconds: number;
  position: {x: number; y: number; z: number};
  targetIds: string[];
  teammateIds: string[];
  evidence: {
    tick: number;
    travel: number;
    displacement: number;
    targetChanges: number;
    driveReversals: number;
    input: Tank['input'];
    decision: Tank['decision'];
    movementFlags: number[];
    status: number;
    disguised: boolean;
    breach: Tank['breach'];
  };
}

interface TankAnalysis {
  id: string;
  name?: string;
  team: number;
  tankId: number;
  control: Tank['control'];
  samples: number;
  observedSeconds: number;
  travel: number;
  targetChanges: number;
  driveReversals: number;
  recoveryReplans: number;
  history: Observation[];
  episodes: Map<IssueKind, Episode>;
}

const distance = (a: Tank, b: Tank): number => Math.hypot(a.x - b.x, a.z - b.z);
const rounded = (value: number): number => Math.round(value * 100) / 100;

function analyze(records: CpuTraceRecord[]) {
  records.sort((a, b) => a.at - b.at);
  const first = records[0];
  const tanks = new Map<string, TankAnalysis>();
  const incidents: Episode[] = [];
  const cells = new Map<string, {x: number; z: number; samples: number; playerIds: Set<string>}>();
  let ticks = 0, totalMs = 0, maxMs = 0, overBudget = 0, maxIntervalMs = 0;
  let gaps = 0, droppedSamples = 0;
  let previous: CpuTraceRecord | undefined;
  for (const record of records) {
    if (previous?.tick === record.tick) continue;
    if (previous && record.at - previous.at > 1500) gaps++;
    previous = record;
    ticks += record.tickTiming.count;
    totalMs += record.tickTiming.totalMs;
    maxMs = Math.max(maxMs, record.tickTiming.maxMs);
    overBudget += record.tickTiming.overBudget;
    maxIntervalMs = Math.max(maxIntervalMs, record.tickTiming.maxIntervalMs);
    droppedSamples = Math.max(droppedSamples, record.droppedSamples);
    const present = new Set(record.tanks.map(tank => tank.id));
    for (const stats of tanks.values()) {
      if (!present.has(stats.id)) {stats.history = []; stats.episodes.clear();}
    }
    for (const tank of record.tanks) {
      if (tank.control === 'HUMAN') continue;
      let stats = tanks.get(tank.id);
      if (!stats) {
        stats = {id: tank.id, name: tank.name, team: tank.team, tankId: tank.tankId, control: tank.control,
          samples: 0, observedSeconds: 0, travel: 0, targetChanges: 0, driveReversals: 0,
          recoveryReplans: 0,
          history: [], episodes: new Map()};
        tanks.set(tank.id, stats);
      }
      stats.samples++;
      const last = stats.history.at(-1);
      const gap = last ? record.at - last.at : 0;
      if (!tank.alive || !last || gap > 1500 || tank.deaths !== last.tank.deaths
          || (tank.decision?.targetChanges ?? 0) < (last.tank.decision?.targetChanges ?? 0)) {
        stats.history = [];
        stats.episodes.clear();
      } else {
        stats.observedSeconds += gap / 1000;
        stats.travel += distance(tank, last.tank);
        stats.targetChanges += Math.max(0,
          (tank.decision?.targetChanges ?? 0) - (last.tank.decision?.targetChanges ?? 0));
        stats.driveReversals += Math.max(0,
          (tank.decision?.driveReversals ?? 0) - (last.tank.decision?.driveReversals ?? 0));
        stats.recoveryReplans += Math.max(0,
          (tank.decision?.recoveryReplans ?? 0) - (last.tank.decision?.recoveryReplans ?? 0));
      }
      if (!tank.alive) continue;
      const teammates = record.mode <= 3 ? record.tanks.filter(other => other.alive
        && other.id !== tank.id && other.team === tank.team
        && Math.abs(other.y - tank.y) < 24 && distance(other, tank) < 80).map(other => other.id) : [];
      stats.history.push({at: record.at, tank, teammates});
      while (stats.history.length && record.at - stats.history[0].at > 8000) stats.history.shift();
      const history = stats.history;
      if (history.length < 2) continue;
      const start = history[0];
      const seconds = (record.at - start.at) / 1000;
      const travel = history.slice(1).reduce((sum, item, index) =>
        sum + distance(item.tank, history[index].tank), 0);
      const displacement = distance(start.tank, tank);
      const targetChanges = Math.max(0,
        (tank.decision?.targetChanges ?? 0) - (start.tank.decision?.targetChanges ?? 0));
      const driveReversals = Math.max(0,
        (tank.decision?.driveReversals ?? 0) - (start.tank.decision?.driveReversals ?? 0));
      const recent = history.filter(item => record.at - item.at <= 4500);
      const stationary = recent.length > 1 && record.at - recent[0].at >= 3500
        && recent.every(item => distance(item.tank, tank) < 6);
      const share = (predicate: (item: Observation) => boolean) => recent.filter(predicate).length / recent.length;
      const moving = share(item => Math.abs(item.tank.input.move) > .1) >= .7;
      const crowded = stationary && share(item => item.teammates.length > 0) >= .8
        && (moving || share(item => (item.tank.decision?.stalledSeconds ?? 0) >= 1) >= .7);
      const kinds: IssueKind[] = [];
      if (stationary && moving) kinds.push('movement-stalled');
      if (stationary && share(item => !!item.tank.decision?.targetId
          && !item.tank.decision.targetVisible && !item.tank.input.fire
          && item.tank.input.move === 0 && item.tank.input.turn === 0) >= .8) kinds.push('idle-with-target');
      if (crowded) kinds.push('teammate-congestion');
      if (seconds >= 5 && driveReversals >= 6 && displacement < 24) kinds.push('drive-oscillation');
      if (seconds >= 5 && targetChanges >= 4) kinds.push('target-churn');
      if (kinds.length) {
        const x = Math.floor(tank.x / 128) * 128, z = Math.floor(tank.z / 128) * 128;
        const key = `${x},${z}`;
        const cell = cells.get(key) ?? {x, z, samples: 0, playerIds: new Set<string>()};
        cell.samples++;
        cell.playerIds.add(tank.id);
        cells.set(key, cell);
      }
      for (const kind of kinds) {
        const window = ['drive-oscillation', 'target-churn'].includes(kind) ? history : recent;
        const from = window[0].at;
        let episode = stats.episodes.get(kind);
        if (!episode || from > episode.to) {
          episode = {kind, playerId: tank.id, from, to: record.at, seconds: 0,
            fromBattleSeconds: rounded((from - record.startedAt) / 1000), toBattleSeconds: 0,
            position: {x: tank.x, y: tank.y, z: tank.z}, targetIds: [], teammateIds: [],
            evidence: {tick: record.tick, travel: 0, displacement: 0, targetChanges: 0,
              driveReversals: 0, input: tank.input, decision: tank.decision,
              movementFlags: tank.movementFlags, status: tank.status,
              disguised: tank.disguised, breach: tank.breach}};
          stats.episodes.set(kind, episode);
          incidents.push(episode);
        }
        episode.to = record.at;
        episode.seconds = rounded((episode.to - episode.from) / 1000);
        episode.toBattleSeconds = rounded((record.at - record.startedAt) / 1000);
        episode.targetIds = [...new Set([...episode.targetIds,
          ...window.flatMap(item => item.tank.decision?.targetId ? [item.tank.decision.targetId] : [])])];
        episode.teammateIds = [...new Set([...episode.teammateIds, ...window.flatMap(item => item.teammates)])];
        episode.evidence = {tick: record.tick, travel: rounded(travel), displacement: rounded(displacement),
          targetChanges, driveReversals, input: tank.input, decision: tank.decision,
          movementFlags: tank.movementFlags, status: tank.status, disguised: tank.disguised, breach: tank.breach};
      }
    }
  }
  return {session: first.session, roomId: first.roomId, round: first.round,
    mapId: first.mapId, mode: first.mode, from: first.at, to: records.at(-1)!.at,
    gaps, droppedSamples,
    timing: {ticks, meanStepMs: rounded(totalMs / Math.max(1, ticks)), maxStepMs: rounded(maxMs),
      overBudget, maxIntervalMs: rounded(maxIntervalMs)},
    tanks: [...tanks.values()].map(({history, episodes, ...stats}) =>
      ({...stats, observedSeconds: rounded(stats.observedSeconds), travel: rounded(stats.travel),
        incidents: incidents.filter(episode => episode.playerId === stats.id).length})),
    hotspots: [...cells.values()].sort((a, b) => b.samples - a.samples).slice(0, 20)
      .map(cell => ({...cell, playerIds: [...cell.playerIds]})),
    incidents: incidents.sort((a, b) => b.seconds - a.seconds)};
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const outputIndex = args.indexOf('--output');
  let output: string | undefined;
  if (outputIndex >= 0) {
    output = args[outputIndex + 1];
    if (!output) throw new Error('--output requires a file path');
    args.splice(outputIndex, 2);
  }
  if (!args.length) throw new Error(
    'Usage: npm run ai:analyze -- state/cpu-traces/R1.ndjson* [--output report.json]');
  const rounds = new Map<string, CpuTraceRecord[]>();
  let skippedLines = 0;
  for (const path of new Set(args.map(path => resolve(path)))) {
    const lines = createInterface({input: createReadStream(path), crlfDelay: Infinity});
    for await (const line of lines) {
      if (!line.trim()) continue;
      let record: CpuTraceRecord;
      try {record = JSON.parse(line) as CpuTraceRecord;}
      catch {skippedLines++; continue;}
      if (record.type !== 'sample') continue;
      const key = `${record.session}/${record.roomId}/${record.round}`;
      const records = rounds.get(key) ?? [];
      records.push(record);
      rounds.set(key, records);
    }
  }
  const report = {files: args, skippedLines,
    rounds: [...rounds.values()].map(analyze)};
  const json = `${JSON.stringify(report, null, 2)}\n`;
  if (output) await writeFile(output, json);
  else process.stdout.write(json);
}

void main().catch(error => {console.error(String(error)); process.exitCode = 1;});
