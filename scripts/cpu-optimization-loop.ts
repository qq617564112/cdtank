import {createReadStream} from 'node:fs';
import {access, cp, mkdir, readFile, readdir, rename, writeFile} from 'node:fs/promises';
import {join, resolve} from 'node:path';
import {createInterface} from 'node:readline';
import {DatabaseSync} from 'node:sqlite';
import {spawn, spawnSync} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import type {MatchHistoryRecord} from '../apps/shared/protocols/PtlHistory';
import type {CpuTraceRecord} from '../apps/server/src/runtime/cpu-trace';

interface CompletedMatch {
  key: string;
  roomId: string;
  round: number;
  mapId: number;
  mode: number;
  endedAt: number;
  reason: string;
}

interface PendingIteration extends CompletedMatch {
  iteration: number;
  directory: string;
  traceFile: string;
  analysisFile: string;
  session: string;
  samples: number;
  startedAt: number;
}

interface FinishedIteration extends PendingIteration {
  reportFile: string;
  changesFile: string;
  changedFiles: string[];
  applied: string;
  completedAt: number;
}

interface LoopState {
  startedAt: number;
  limit: number;
  completed: FinishedIteration[];
  skipped: {key: string; reason: string}[];
  pending?: PendingIteration;
}

const args = process.argv.slice(2);
const command = args.shift() ?? 'wait';
const option = (name: string): string | undefined => {
  const at = args.indexOf(name);
  if (at < 0) return undefined;
  const value = args[at + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a value`);
  return value;
};
const root = resolve(option('--directory') ?? 'state/cpu-optimization');
const stateFile = join(root, 'status.json');
const traceDirectory = resolve(process.env.CPU_TRACE_DIR ?? 'state/cpu-traces');
const sourceDirectory = resolve('apps/server/src/battle/cpu');

async function save(state: LoopState): Promise<void> {
  await mkdir(root, {recursive: true});
  await writeFile(`${stateFile}.tmp`, `${JSON.stringify(state, null, 2)}\n`);
  await rename(`${stateFile}.tmp`, stateFile);
}

async function readState(): Promise<LoopState> {
  try {return JSON.parse(await readFile(stateFile, 'utf8')) as LoopState;}
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    const startedAt = Number(option('--since') ?? Date.now());
    if (!Number.isFinite(startedAt) || startedAt <= 0) throw new Error('--since must be epoch milliseconds');
    const state: LoopState = {startedAt, limit: 10, completed: [], skipped: []};
    await save(state);
    return state;
  }
}

async function sourceFiles(directory: string, prefix = ''): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(directory, {withFileTypes: true})) {
    const name = join(prefix, entry.name);
    if (entry.isDirectory()) files.push(...await sourceFiles(join(directory, entry.name), name));
    else if (entry.name.endsWith('.ts')) files.push(name);
  }
  return files.sort();
}

async function collectTrace(match: CompletedMatch): Promise<CpuTraceRecord[]> {
  const groups = new Map<string, CpuTraceRecord[]>();
  const files = (await readdir(traceDirectory)).filter(name =>
    name === `${match.roomId}.ndjson` || name.startsWith(`${match.roomId}.ndjson.`));
  for (const file of files) {
    const lines = createInterface({input: createReadStream(join(traceDirectory, file)), crlfDelay: Infinity});
    for await (const line of lines) {
      if (!line.trim()) continue;
      let row: CpuTraceRecord;
      try {row = JSON.parse(line) as CpuTraceRecord;}
      catch {continue;}
      if (row.type !== 'sample' || row.roomId !== match.roomId || row.round !== match.round
          || row.mapId !== match.mapId || row.mode !== match.mode || row.at > match.endedAt
          || row.startedAt >= match.endedAt) continue;
      const records = groups.get(row.session) ?? [];
      records.push(row);
      groups.set(row.session, records);
    }
  }
  const selected = [...groups.values()].sort((a, b) =>
    Math.max(...b.map(row => row.at)) - Math.max(...a.map(row => row.at)))[0];
  if (!selected) throw new Error(`No trace for completed match ${match.key}`);
  const unique = [...new Map(selected.map(row => [row.tick, row])).values()].sort((a, b) => a.at - b.at);
  if (match.endedAt - unique.at(-1)!.at > 3000) {
    throw new Error(`Trace does not reach match completion: ${match.key}`);
  }
  return unique;
}

async function analyze(traceFile: string, analysisFile: string): Promise<void> {
  await new Promise<void>((done, reject) => {
    const child = spawn(process.execPath, ['--import', 'tsx', 'scripts/analyze-cpu-traces.ts',
      traceFile, '--output', analysisFile], {stdio: ['ignore', 'ignore', 'inherit']});
    child.on('error', reject);
    child.on('exit', code => code === 0 ? done() : reject(new Error(`Trace analysis exited ${code}`)));
  });
}

function notification(state: LoopState): void {
  console.log(JSON.stringify({event: state.pending ? 'MATCH_READY' : 'STOPPED',
    completed: state.completed.length, limit: state.limit, pending: state.pending,
    instruction: state.pending
      ? '逐辆核对新对局轨迹，按证据优化一次，使行为更自然、顺畅、像真人。保存 report.md，确认代码应用后执行 complete。完成十次后停止。'
      : '已完成十次优化，停止领取新对局。'}, null, 2));
}

async function wait(state: LoopState): Promise<void> {
  if (state.pending || state.completed.length >= state.limit) {notification(state); return;}
  const database = new DatabaseSync(resolve(option('--database')
    ?? process.env.ACCOUNT_DB_PATH ?? 'state/accounts.sqlite'), {readOnly: true});
  console.error(`Waiting for a committed match; ${state.completed.length}/${state.limit} optimizations completed.`);
  try {
    for (;;) {
      const matches = database.prepare(`SELECT match_id, round, ended_at, MIN(record) AS record
        FROM match_history WHERE ended_at >= ? GROUP BY match_id, round
        ORDER BY ended_at, match_id, round`).all(state.startedAt);
      for (const row of matches) {
        const record = JSON.parse(String(row.record)) as MatchHistoryRecord;
        const match: CompletedMatch = {key: `${String(row.match_id)}:${Number(row.round)}`,
          roomId: String(row.match_id).split(':').at(-1)!, round: Number(row.round),
          mode: record.mode, mapId: record.mapId, endedAt: Number(row.ended_at), reason: record.reason};
        if (state.completed.some(item => item.key === match.key)
            || state.skipped.some(item => item.key === match.key)) continue;
        // Settlement precedes the recorder's ordinary two-second asynchronous flush.
        await delay(Math.max(0, match.endedAt + 2500 - Date.now()));
        const records = await collectTrace(match);
        if (!records.some(record => record.tanks.some(tank => tank.control !== 'HUMAN'))) {
          state.skipped.push({key: match.key, reason: 'No CPU or autopilot participant'});
          await save(state);
          continue;
        }
        const directory = join(root, String(state.completed.length + 1).padStart(2, '0'));
        await mkdir(directory, {recursive: true});
        const traceFile = join(directory, `${match.roomId}.ndjson`);
        const analysisFile = join(directory, 'analysis.json');
        await writeFile(traceFile, records.map(row => JSON.stringify(row)).join('\n') + '\n');
        await analyze(traceFile, analysisFile);
        await cp(sourceDirectory, join(directory, 'before'), {recursive: true});
        state.pending = {...match, iteration: state.completed.length + 1, directory, traceFile,
          analysisFile, session: records[0].session, samples: records.length, startedAt: records[0].startedAt};
        await writeFile(join(directory, 'match.json'), `${JSON.stringify(state.pending, null, 2)}\n`);
        await save(state);
        notification(state);
        return;
      }
      await delay(2000);
    }
  } finally {database.close();}
}

async function complete(state: LoopState): Promise<void> {
  const pending = state.pending;
  if (!pending) throw new Error('No pending match; run wait first');
  const reportFile = resolve(option('--report') ?? join(pending.directory, 'report.md'));
  const applied = option('--applied');
  if (!applied) throw new Error('--applied requires the actual activation evidence');
  if (!(await readFile(reportFile, 'utf8')).trim()) throw new Error('The report is empty');
  const beforeDirectory = join(pending.directory, 'before');
  const files = [...new Set([...await sourceFiles(beforeDirectory), ...await sourceFiles(sourceDirectory)])].sort();
  const changedFiles: string[] = [];
  let patch = '';
  for (const file of files) {
    const before = join(beforeDirectory, file), after = join(sourceDirectory, file);
    const exists = async (path: string): Promise<boolean> => access(path).then(() => true, () => false);
    const result = spawnSync('diff', ['-u', '--label', `before/apps/server/src/battle/cpu/${file}`,
      '--label', `after/apps/server/src/battle/cpu/${file}`,
      await exists(before) ? before : '/dev/null', await exists(after) ? after : '/dev/null'], {encoding: 'utf8'});
    if (result.status !== 0 && result.status !== 1) throw new Error(result.stderr || 'Unable to save AI changes');
    if (result.status === 1) {changedFiles.push(file); patch += result.stdout;}
  }
  if (!changedFiles.length) throw new Error('No AI source change; this does not count as an optimization');
  const changesFile = join(pending.directory, 'changes.diff');
  await writeFile(changesFile, patch);
  await cp(sourceDirectory, join(pending.directory, 'after'), {recursive: true});
  state.completed.push({...pending, reportFile, changesFile, changedFiles, applied, completedAt: Date.now()});
  state.pending = undefined;
  await save(state);
  console.log(JSON.stringify({event: state.completed.length >= state.limit ? 'STOPPED' : 'OPTIMIZATION_COMPLETED',
    completed: state.completed.length, limit: state.limit, reportFile, changesFile}, null, 2));
}

async function main(): Promise<void> {
  const state = await readState();
  if (command === 'wait') await wait(state);
  else if (command === 'complete') await complete(state);
  else if (command === 'status') console.log(JSON.stringify(state, null, 2));
  else throw new Error('Usage: cpu-optimization-loop.ts wait|status|complete [--since milliseconds] [--report path] [--applied evidence]');
}

void main().catch(error => {console.error(String(error)); process.exitCode = 1;});
