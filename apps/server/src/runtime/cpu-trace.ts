import {appendFile, mkdir, rename, rm, stat} from 'node:fs/promises';
import {join, resolve} from 'node:path';
import type {CpuTraceSnapshot} from '../battle/cpu/trace';

const SAMPLE_MS = 500;
const FLUSH_MS = 2000;
const FILE_BYTES = 8 * 1024 * 1024;
const QUEUE_BYTES = 1024 * 1024;

export interface CpuTraceRecord extends CpuTraceSnapshot {
  type: 'sample';
  session: string;
  tickTiming: {count: number; totalMs: number; maxMs: number; overBudget: number; maxIntervalMs: number};
  droppedSamples: number;
}

/** Bounded per-room trace, with file I/O outside the simulation's synchronous work. */
export class CpuTraceRecorder {
  private readonly directory = resolve(process.env.CPU_TRACE_DIR ?? 'state/cpu-traces');
  private readonly session = `${new Date().toISOString()}-${process.pid}`;
  private readonly file: string;
  private nextSample = 0;
  private previousTick?: number;
  private timing = this.emptyTiming();
  private queue: string[] = [];
  private queueBytes = 0;
  private fileBytes = 0;
  private droppedSamples = 0;
  private failed = false;
  private closed = false;
  private writing?: Promise<void>;
  private readonly initialized: Promise<void>;
  private readonly timer: ReturnType<typeof setInterval>;

  constructor(roomId: string, private readonly tickMs: number) {
    this.file = join(this.directory, `${roomId}.ndjson`);
    this.initialized = this.initialize().catch(error => this.fail(error));
    this.timer = setInterval(() => {void this.flush();}, FLUSH_MS);
    this.timer.unref();
  }

  private async initialize(): Promise<void> {
    await mkdir(this.directory, {recursive: true});
    try {this.fileBytes = (await stat(this.file)).size;}
    catch (error) {if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;}
  }

  private emptyTiming(): CpuTraceRecord['tickTiming'] {
    return {count: 0, totalMs: 0, maxMs: 0, overBudget: 0, maxIntervalMs: 0};
  }

  record(tickAt: number, stepMs: number, read: () => CpuTraceSnapshot | undefined): void {
    if (this.failed || this.closed) return;
    this.timing.count++;
    this.timing.totalMs += stepMs;
    this.timing.maxMs = Math.max(this.timing.maxMs, stepMs);
    this.timing.overBudget += Number(stepMs > this.tickMs);
    if (this.previousTick !== undefined) {
      this.timing.maxIntervalMs = Math.max(this.timing.maxIntervalMs, tickAt - this.previousTick);
    }
    this.previousTick = tickAt;
    if (tickAt < this.nextSample) return;
    this.nextSample = tickAt + SAMPLE_MS;
    const snapshot = read();
    const timing = this.timing;
    this.timing = this.emptyTiming();
    if (!snapshot || snapshot.phase !== 'PLAYING' || snapshot.at < snapshot.startedAt
        || !snapshot.tanks.some(tank => tank.control !== 'HUMAN')) return;
    const record: CpuTraceRecord = {...snapshot, type: 'sample', session: this.session,
      tickTiming: timing, droppedSamples: this.droppedSamples};
    const line = `${JSON.stringify(record)}\n`;
    const bytes = Buffer.byteLength(line);
    if (this.queueBytes + bytes > QUEUE_BYTES) {this.droppedSamples++; return;}
    this.queue.push(line);
    this.queueBytes += bytes;
  }

  private fail(error: unknown): void {
    this.failed = true;
    this.queue = [];
    this.queueBytes = 0;
    console.warn('CPU trace recording stopped', {file: this.file, error: String(error)});
  }

  private async rotate(): Promise<void> {
    await rm(`${this.file}.2`, {force: true});
    for (const [from, to] of [[`${this.file}.1`, `${this.file}.2`], [this.file, `${this.file}.1`]]) {
      try {await rename(from, to);}
      catch (error) {if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;}
    }
    this.fileBytes = 0;
  }

  private flush(): Promise<void> {
    if (this.writing) return this.writing;
    if (this.failed || !this.queue.length) return Promise.resolve();
    const chunk = this.queue.join('');
    const bytes = this.queueBytes;
    this.queue = [];
    this.queueBytes = 0;
    this.writing = (async () => {
      await this.initialized;
      if (this.failed) return;
      if (this.fileBytes + bytes > FILE_BYTES) await this.rotate();
      await appendFile(this.file, chunk);
      this.fileBytes += bytes;
    })().catch(error => this.fail(error)).finally(() => {this.writing = undefined;});
    return this.writing;
  }

  async close(): Promise<void> {
    this.closed = true;
    clearInterval(this.timer);
    await this.writing;
    await this.flush();
  }
}
