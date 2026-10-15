import type {TrainingCommand, TrainingPublication, TrainingReply} from './protocol';
import type {MsgRoomSnapshot, MsgRoomEvent} from '../../../shared/protocols';

/** All room commands and player inputs stay inside this browser's worker. */
export class TrainingSession {
  private readonly worker = new Worker(new URL('./worker.ts', import.meta.url), {type: 'module'});
  private nextRequest = 1;
  private stopped = false;
  private readonly pending = new Map<number, {resolve(value: TrainingReply): void; reject(error: Error): void}>();

  constructor(private readonly publish: (snapshot: MsgRoomSnapshot, events: MsgRoomEvent[]) => void,
    private readonly failed: (error: Error) => void) {
    this.worker.onmessage = (event: MessageEvent<TrainingPublication>) => {
      const message = event.data;
      if (message.type === 'state') this.publish(message.snapshot, message.events);
      else if (message.type === 'failure') this.fail(new Error(message.error));
      else {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(message.error));
        else pending.resolve(message.result ?? {});
      }
    };
    this.worker.onerror = event => {event.preventDefault(); this.fail(new Error(event.message || '训练运行失败'));};
  }

  request(command: TrainingCommand): Promise<TrainingReply> {
    if (this.stopped) return Promise.reject(new Error('训练已经结束'));
    const id = this.nextRequest++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, {resolve, reject});
      this.worker.postMessage({id, command});
    });
  }

  input(command: Extract<TrainingCommand, {type: 'input' | 'action'}>): void {
    if (!this.stopped) this.worker.postMessage({id: 0, command});
  }

  dispose(): void {
    if (this.stopped) return;
    this.stopped = true;
    this.worker.terminate();
    for (const pending of this.pending.values()) pending.reject(new Error('训练已经结束'));
    this.pending.clear();
  }

  private fail(error: Error): void {
    if (this.stopped) return;
    this.dispose();
    this.failed(error);
  }
}
