import {readSync, writeSync} from 'node:fs';
import {serialize, deserialize} from 'node:v8';
import type {Readable, Writable} from 'node:stream';
import type {RoomServices, RoomServiceRequest, RoomServiceReply} from './room-protocol';

function frame(value: unknown): Buffer {
  const payload = serialize(value);
  const header = Buffer.allocUnsafe(4);
  header.writeUInt32BE(payload.length);
  return Buffer.concat([header, payload]);
}

function readExactly(fd: number, length: number): Buffer {
  const buffer = Buffer.allocUnsafe(length);
  let offset = 0;
  while (offset < length) {
    const count = readSync(fd, buffer, offset, length - offset, null);
    if (count === 0) throw new Error('房间账号管道已关闭');
    offset += count;
  }
  return buffer;
}

/** Extra inherited descriptors stay blocking in the child; the gateway uses streams. */
export function callRoomService<K extends keyof RoomServices>(method: K,
  ...args: Parameters<RoomServices[K]>): ReturnType<RoomServices[K]> {
  const request = frame({method, args});
  let offset = 0;
  while (offset < request.length) offset += writeSync(4, request, offset, request.length - offset);
  const length = readExactly(5, 4).readUInt32BE();
  const reply = deserialize(readExactly(5, length)) as RoomServiceReply;
  if (reply.error !== undefined) throw new Error(reply.error);
  return reply.result as ReturnType<RoomServices[K]>;
}

/** Synchronous account transactions execute only on the gateway's one account store. */
export function serveRoomServices(requests: Readable, replies: Writable,
  services: RoomServices, onError: (error: Error) => void): void {
  let pending: Buffer = Buffer.alloc(0);
  requests.on('data', (chunk: Buffer) => {
    pending = pending.length ? Buffer.concat([pending, chunk]) : chunk;
    while (pending.length >= 4) {
      const length = pending.readUInt32BE();
      if (pending.length < length + 4) break;
      const request = deserialize(pending.subarray(4, length + 4)) as RoomServiceRequest;
      pending = pending.subarray(length + 4);
      let reply: RoomServiceReply;
      try {
        reply = {result: Reflect.apply(services[request.method], services, request.args)};
      } catch (error) {
        reply = {error: error instanceof Error ? error.message : String(error)};
      }
      replies.write(frame(reply));
    }
  });
  requests.on('error', onError);
  replies.on('error', onError);
}
