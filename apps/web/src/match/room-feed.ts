import type {WsClient} from 'tsrpc-browser';
import type {MsgRoomEvent} from '../../../shared/protocols/MsgRoomEvent';
import type {MsgRoomSnapshot} from '../../../shared/protocols/MsgRoomSnapshot';
import type {ServiceType} from '../../../shared/protocols/serviceProto';

interface RoomFeedCallbacks {
  beforeSnapshot(next: MsgRoomSnapshot, previous: MsgRoomSnapshot | undefined): void;
  snapshot(next: MsgRoomSnapshot): void;
  event(event: MsgRoomEvent, current: MsgRoomSnapshot | undefined): void;
}

/** Owns accepted messages for the room joined on the shared transport. */
export class RoomFeed {
  private currentRoomId?: string;
  private currentSnapshot?: MsgRoomSnapshot;
  private snapshotReceivedAt = 0;

  constructor(client: WsClient<ServiceType>, private readonly callbacks: RoomFeedCallbacks) {
    client.listenMsg('RoomSnapshot', snapshot => {this.receive(snapshot);});
    client.listenMsg('RoomEvent', event => {
      if (event.roomId !== this.currentRoomId) return;
      callbacks.event(event, this.currentSnapshot);
    });
  }

  receive(snapshot: MsgRoomSnapshot): void {
    if (snapshot.roomId !== this.currentRoomId) return;
    const previous = this.currentSnapshot;
    if (previous && snapshot.match && previous.match &&
        (snapshot.match.round < previous.match.round ||
        (snapshot.match.round === previous.match.round && snapshot.tick < previous.tick))) return;
    this.callbacks.beforeSnapshot(snapshot, previous);
    this.currentSnapshot = snapshot;
    this.snapshotReceivedAt = performance.now();
    this.callbacks.snapshot(snapshot);
  }

  get roomId(): string | undefined {return this.currentRoomId;}

  get snapshot(): MsgRoomSnapshot | undefined {return this.currentSnapshot;}

  get receivedAt(): number {return this.snapshotReceivedAt;}

  enter(roomId: string): void {
    if (roomId !== this.currentRoomId) this.clear();
    this.currentRoomId = roomId;
  }

  clear(): void {
    this.currentRoomId = undefined;
    this.currentSnapshot = undefined;
    this.snapshotReceivedAt = 0;
  }
}
