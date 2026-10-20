import {spawn, spawnSync} from 'node:child_process';
import {randomInt} from 'node:crypto';
import {access, cp, mkdir, open, readFile, readdir, rename, writeFile} from 'node:fs/promises';
import {join, resolve} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {MAPS} from '../apps/server/src/config';
import type {CpuTraceRecord} from '../apps/server/src/runtime/cpu-trace';

interface ArenaMatch {mapId: number; name: string; roomId: string; directory: string;}
interface ArenaRound {
  iteration: number;
  matches: ArenaMatch[];
  phase: 'PENDING' | 'PLAYING' | 'ANALYZE' | 'COMPLETE';
  applied?: string;
}
interface ArenaState {startedAt: number; limit: number; rounds: ArenaRound[];}
const command = process.argv[2] ?? 'wait';
const root = resolve(process.argv[3] ?? 'state/cpu-arena');
const requestedRounds = Number(process.argv[4] ?? 10);
if (!Number.isInteger(requestedRounds) || requestedRounds < 1) throw new Error('Expected a positive round count');
const source = resolve('apps/server/src/battle/cpu');
const stateFile = join(root, 'status.json');
const roundDirectory = (round: ArenaRound) => join(root, String(round.iteration).padStart(2, '0'));
const exists = async (file: string) => access(file).then(() => true, () => false);
async function save(state: ArenaState): Promise<void> {
  await writeFile(`${stateFile}.tmp`, JSON.stringify(state, null, 2) + '\n');
  await rename(`${stateFile}.tmp`, stateFile);
}
async function state(): Promise<ArenaState> {
  if (await exists(stateFile)) return JSON.parse(await readFile(stateFile, 'utf8')) as ArenaState;
  await mkdir(root, {recursive: true});
  const maps = MAPS.filter(map => map.mode === 1 && map.mapId >= 1 && map.mapId <= 25);
  let bag = [...maps];
  const rounds: ArenaRound[] = [];
  for (let iteration = 1; iteration <= requestedRounds; iteration++) {
    const chosen: number[] = [];
    const matches: ArenaMatch[] = [];
    for (let slot = 1; slot <= 3; slot++) {
      if (!bag.length) bag = [...maps];
      const candidates = bag.filter(map => !chosen.includes(map.mapId));
      const map = candidates[randomInt(candidates.length)];
      bag.splice(bag.indexOf(map), 1);
      chosen.push(map.mapId);
      const roomId = `A${String(iteration).padStart(2, '0')}-${slot}`;
      matches.push({mapId: map.mapId, name: map.name, roomId,
        directory: join(root, String(iteration).padStart(2, '0'), roomId)});
    }
    rounds.push({iteration, matches, phase: 'PENDING'});
  }
  const created: ArenaState = {startedAt: Date.now(), limit: requestedRounds, rounds};
  await save(created);
  return created;
}
async function runMatch(match: ArenaMatch): Promise<void> {
  if (await exists(join(match.directory, 'finished.json'))) return;
  if (await exists(join(match.directory, 'started.json'))) {
    const previous = JSON.parse(await readFile(join(match.directory, 'started.json'), 'utf8'));
    try {process.kill(previous.pid, 0); throw new Error(`Room ${match.roomId} is still running: ${previous.pid}`);}
    catch (error) {if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error;}
    const archive = `${match.directory}.interrupted-${Date.now()}`;
    await rename(match.directory, archive);
  }
  await mkdir(match.directory, {recursive: true});
  const log = await open(join(match.directory, 'server.log'), 'a');
  try {
    await new Promise<void>((done, reject) => {
      const child = spawn(process.execPath, ['--import', 'tsx', 'scripts/cpu-arena-worker.ts',
        match.directory, String(match.mapId), match.roomId], {stdio: ['ignore', log.fd, log.fd]});
      child.on('error', reject);
      child.on('exit', code => code === 0 ? done() : reject(new Error(
        `Room ${match.roomId} exited ${code}; inspect ${match.directory}/server.log`)));
    });
  } finally {await log.close();}
}
async function analyze(match: ArenaMatch): Promise<void> {
  const files = (await readdir(match.directory)).filter(name => name.startsWith(`${match.roomId}.ndjson`));
  const records: CpuTraceRecord[] = [];
  for (const file of files) {
    for (const line of (await readFile(join(match.directory, file), 'utf8')).trim().split('\n')) {
      if (line) records.push(JSON.parse(line) as CpuTraceRecord);
    }
  }
  records.sort((a, b) => a.at - b.at);
  const settlement = JSON.parse(await readFile(join(match.directory, 'settlement.json'), 'utf8'));
  if (!records.length || records[0].at - records[0].startedAt > 1500
      || settlement.result.endedAt - records.at(-1)!.at > 1500
      || records.some(row => row.tanks.some(tank => tank.control !== 'CPU'))) {
    throw new Error(`Incomplete CPU-only trace: ${match.roomId}`);
  }
  const traceFile = join(match.directory, 'trace.ndjson');
  await writeFile(traceFile, records.map(row => JSON.stringify(row)).join('\n') + '\n');
  await new Promise<void>((done, reject) => {
    const child = spawn(process.execPath, ['--import', 'tsx', 'scripts/analyze-cpu-traces.ts',
      traceFile, '--output', join(match.directory, 'analysis.json')], {stdio: ['ignore', 'ignore', 'inherit']});
    child.on('error', reject);
    child.on('exit', code => code === 0 ? done() : reject(new Error(`Analysis exited ${code}`)));
  });
}
async function wait(current: ArenaState): Promise<void> {
  const round = current.rounds.find(value => value.phase !== 'COMPLETE');
  if (!round) {console.log(JSON.stringify({event: 'STOPPED', completed: current.limit})); return;}
  const directory = roundDirectory(round);
  if (round.phase !== 'ANALYZE') {
    if (round.phase === 'PENDING') {
      await mkdir(directory, {recursive: true});
      await cp(source, join(directory, 'before'), {recursive: true});
      round.phase = 'PLAYING';
      await save(current);
    }
    console.log(JSON.stringify({event: 'ROUND_STARTED', iteration: round.iteration, matches: round.matches}));
    const running = Promise.allSettled(round.matches.map(runMatch));
    let done = false;
    void running.then(() => {done = true;});
    while (!done) {
      const rooms = await Promise.all(round.matches.map(async match => ({roomId: match.roomId,
        mapId: match.mapId, finished: await exists(join(match.directory, 'finished.json'))})));
      console.log(JSON.stringify({event: 'PROGRESS', iteration: round.iteration, rooms}));
      await Promise.race([running, delay(15000)]);
    }
    const results = await running;
    for (const result of results) if (result.status === 'rejected') throw result.reason;
    for (const match of round.matches) await analyze(match);
    round.phase = 'ANALYZE';
    await save(current);
  }
  console.log(JSON.stringify({event: 'ROUND_READY', iteration: round.iteration, matches: round.matches,
    instruction: '三局已全部结算并归档。逐车分析，按证据优化，保存report.md后执行complete，再wait启动下一轮。'}));
}
async function complete(current: ArenaState): Promise<void> {
  const round = current.rounds.find(value => value.phase !== 'COMPLETE');
  if (!round || round.phase !== 'ANALYZE') throw new Error('No fully finished round awaits optimization');
  const directory = roundDirectory(round);
  if (!(await readFile(join(directory, 'report.md'), 'utf8')).trim()) throw new Error('Empty round report');
  const files = (await readdir(source)).filter(file => file.endsWith('.ts'));
  let patch = '';
  for (const file of files) {
    const result = spawnSync('diff', ['-u', '--label', `before/${file}`, '--label', `after/${file}`,
      join(directory, 'before', file), join(source, file)], {encoding: 'utf8'});
    if (result.status !== 0 && result.status !== 1) throw new Error(result.stderr);
    patch += result.stdout;
  }
  await writeFile(join(directory, 'changes.diff'), patch);
  await cp(source, join(directory, 'after'), {recursive: true});
  round.applied = patch
    ? 'All three room processes exited; next round starts new processes from updated source.'
    : 'All three room processes exited; analysis retained the current CPU source.';
  round.phase = 'COMPLETE';
  await save(current);
  console.log(JSON.stringify({event: current.rounds.every(value => value.phase === 'COMPLETE')
    ? 'STOPPED' : 'ROUND_COMPLETED', iteration: round.iteration}));
}
const current = await state();
if (command === 'wait') await wait(current);
else if (command === 'complete') await complete(current);
else if (command === 'status') console.log(JSON.stringify(current, null, 2));
else throw new Error('Usage: cpu-arena.ts wait|complete|status [directory] [rounds]');
