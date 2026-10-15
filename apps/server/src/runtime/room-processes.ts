import {fork, type ChildProcess} from 'node:child_process';
import {existsSync} from 'node:fs';
import {join, resolve} from 'node:path';
import type {Readable, Writable} from 'node:stream';
import type {MsgRoomSnapshot, RoomSummary} from '../../../shared/protocols';
import {MAPS} from '../config';
import type {World, WorldEvent, JoinResult} from '../world';
import type {RoomCommand, RoomWorld} from '../rooms/world-interface';
import {serveRoomServices} from './room-services';
import type {RoomMessage, RoomRequest, RoomStatePublication, WorldOptions} from './room-protocol';

interface PendingCommand {
  resolve(value: unknown): void;
  reject(error: Error): void;
}

interface RoomProcess {
  roomId: string;
  child: ChildProcess;
  pending: Map<number, PendingCommand>;
  connectionIds: Set<string>;
  ready: Promise<void>;
  snapshot?: MsgRoomSnapshot;
  summary?: RoomSummary;
  closed: boolean;
}

/** Gateway directory and command router; every authoritative World lives in a child. */
export class RoomProcesses implements RoomWorld {
  private readonly rooms = new Map<string, RoomProcess>();
  private readonly players = new Map<string, RoomProcess>();
  private readonly connections = new Map<string, JoinResult>();
  private readonly admissions = new Map<string, Promise<unknown>>();
  private nextRoomId = 1;
  private nextPlayerId = 1;
  private nextCommandId = 1;
  private tickSink?: (snapshot: MsgRoomSnapshot, events: WorldEvent[]) => void;
  private failureSink?: (roomId: string, error: Error) => void;

  constructor(private readonly tickRate: number, private readonly options: WorldOptions = {}) {}

  onTick(sink: (snapshot: MsgRoomSnapshot, events: WorldEvent[]) => void): void {
    this.tickSink = sink;
  }

  onRoomFailure(sink: (roomId: string, error: Error) => void): void {
    this.failureSink = sink;
  }

  listRooms(): RoomSummary[] {
    return [...this.rooms.values()].flatMap(room => room.summary ? [room.summary] : []);
  }

  listMaps(): ReturnType<World['listMaps']> {
    return MAPS.map(map => ({mode: map.mode, mapId: map.mapId, name: map.name,
      timeLimit: map.timeLimit, sourceMinPlayers: map.sourceMinPlayers, maxPlayers: map.maxPlayers}));
  }

  snapshot(roomId: string): MsgRoomSnapshot | undefined {return this.rooms.get(roomId)?.snapshot;}
  roomName(roomId: string): string {return this.rooms.get(roomId)?.summary?.name ?? '';}
  roomPlayers(roomId: string): ReturnType<World['roomPlayers']> {
    return this.snapshot(roomId)?.players.map(player =>
      ({id: player.id, name: player.name, tankId: player.tankId})) ?? [];
  }

  createAndJoin(...args: Parameters<World['createAndJoin']>): Promise<JoinResult> {
    return this.admit(args[0], async () => {
      const existing = this.connections.get(args[0]);
      const room = existing ? this.rooms.get(existing.roomId)! : this.spawn();
      const result = await this.request(room, 'createAndJoin', args, args[0]);
      this.bindConnection(args[0], result);
      return result;
    });
  }

  joinRoom(...args: Parameters<World['joinRoom']>): Promise<JoinResult> {
    return this.admit(args[1], () => this.joinRoomNow(args));
  }

  quickMatch(...args: Parameters<World['quickMatch']>): Promise<JoinResult> {
    return this.admit(args[0], async () => {
      for (const room of this.listRooms()) {
        if (room.hasPassword || room.phase !== 'WAITING' || room.playerCount >= room.maxPlayers) continue;
        try {return await this.joinRoomNow([room.id, ...args]);}
        catch (error) {
          // A concurrent join can fill a published slot before its command arrives.
          const current = this.rooms.get(room.id)?.summary;
          if (current?.phase === 'WAITING' && current.playerCount < current.maxPlayers) throw error;
        }
      }
      throw new Error('暂无可加入的房间，请先开新房间');
    });
  }

  private async joinRoomNow(args: Parameters<World['joinRoom']>): Promise<JoinResult> {
    const room = this.rooms.get(args[0]);
    if (!room) throw new Error('房间不存在');
    const previous = this.connections.get(args[1]);
    const result = await this.request(room, 'joinRoom', args, args[1]);
    if (previous && previous.roomId !== result.roomId) {
      let events: WorldEvent[];
      try {events = await this.leave(previous.playerId);}
      catch (error) {
        await this.leave(result.playerId);
        throw error;
      }
      const snapshot = this.snapshot(previous.roomId);
      if (snapshot) this.tickSink?.(snapshot, events);
    }
    this.bindConnection(args[1], result);
    return result;
  }

  private bindConnection(connectionId: string, session: JoinResult): void {
    const previous = this.connections.get(connectionId);
    if (previous) this.rooms.get(previous.roomId)?.connectionIds.delete(connectionId);
    this.connections.set(connectionId, session);
    this.rooms.get(session.roomId)?.connectionIds.add(connectionId);
  }

  private admit<T>(connectionId: string, operation: () => Promise<T>): Promise<T> {
    const previous = this.admissions.get(connectionId) ?? Promise.resolve();
    const pending = previous.catch(() => {}).then(operation);
    this.admissions.set(connectionId, pending);
    void pending.finally(() => {
      if (this.admissions.get(connectionId) === pending) this.admissions.delete(connectionId);
    }).catch(() => {});
    return pending;
  }

  private spawn(): RoomProcess {
    if (this.rooms.size >= 100) throw new Error('当前房间过多，请加入已有房间');
    const roomId = `R${this.nextRoomId++}`;
    const compiled = typeof __dirname === 'string' ? join(__dirname, 'room-process.js') : '';
    const entry = compiled && existsSync(compiled) ? compiled
      : resolve('apps/server/src/runtime/room-process.ts');
    const child = fork(entry, [], {serialization: 'advanced',
      stdio: ['ignore', 'inherit', 'inherit', 'ipc', 'pipe', 'pipe']});
    let ready!: () => void;
    let rejectReady!: (error: Error) => void;
    const room: RoomProcess = {roomId, child, pending: new Map(), connectionIds: new Set(), closed: false,
      ready: new Promise<void>((resolveReady, reject) => {ready = resolveReady; rejectReady = reject;})};
    this.rooms.set(roomId, room);
    const channels: ReadonlyArray<Readable | Writable | null | undefined> = child.stdio;
    const failed = (error: Error): void => {
      rejectReady(error);
      this.closeRoom(room, error);
    };
    serveRoomServices(channels[4] as Readable, channels[5] as Writable, {
      allocatePlayerId: () => `P${this.nextPlayerId++}`,
      consumeItem: (...args) => this.options.consumeItem?.(...args) ?? false,
      acquireOwnedItem: (...args) => this.options.acquireOwnedItem?.(...args),
      discardOwnedItem: (...args) => this.options.discardOwnedItem?.(...args),
      currentTitle: accountId => this.options.currentTitle?.(accountId),
      commitMatch: match => this.options.onMatchCommitted?.(match),
      inventoryRecord: (accountId, record) => {
        for (const other of this.accountRooms(accountId)) {
          if (other !== room) this.notify(other, 'synchronizeInventoryRecord', [accountId, record]);
        }
      },
    }, failed);
    child.on('error', failed);
    child.on('exit', (code, signal) => failed(new Error(
      `房间 ${roomId} 进程已退出 (${signal ?? code})`)));
    child.on('message', (message: RoomMessage) => {
      if (room.closed) return;
      if (message.type === 'ready') {ready(); return;}
      if (message.state) this.applyState(room, message.state);
      if (message.type === 'tick') {
        if (message.state.snapshot) this.tickSink?.(message.state.snapshot, message.events);
      } else {
        const pending = room.pending.get(message.id);
        room.pending.delete(message.id);
        if (message.error !== undefined) pending?.reject(new Error(message.error));
        else pending?.resolve(message.result);
        if (message.state && !message.state.summary) this.closeRoom(room);
      }
    });
    child.send({type: 'init', roomId, tickRate: this.tickRate,
      options: {minPlayers: this.options.minPlayers, timeLimitSeconds: this.options.timeLimitSeconds}},
    (error: Error | null) => {if (error) failed(error);});
    return room;
  }

  private applyState(room: RoomProcess, state: RoomStatePublication): void {
    for (const player of room.snapshot?.players ?? []) {
      if (this.players.get(player.id) === room) this.players.delete(player.id);
    }
    room.snapshot = state.snapshot;
    room.summary = state.summary;
    const present = new Set(state.snapshot?.players.map(player => player.id));
    for (const player of state.snapshot?.players ?? []) this.players.set(player.id, room);
    for (const connectionId of room.connectionIds) {
      const session = this.connections.get(connectionId);
      if (session && !present.has(session.playerId)) {
        this.connections.delete(connectionId);
        room.connectionIds.delete(connectionId);
      }
    }
  }

  private closeRoom(room: RoomProcess, error?: Error): void {
    if (room.closed) return;
    room.closed = true;
    this.rooms.delete(room.roomId);
    for (const player of room.snapshot?.players ?? []) this.players.delete(player.id);
    for (const id of room.connectionIds) this.connections.delete(id);
    room.connectionIds.clear();
    for (const pending of room.pending.values()) pending.reject(error ?? new Error('房间已关闭'));
    room.pending.clear();
    if (error) {
      if (this.failureSink) this.failureSink(room.roomId, error);
      else console.error(error);
    }
    room.child.kill();
  }

  private async request<K extends RoomCommand>(room: RoomProcess, method: K,
    args: Parameters<World[K]>, connectionId?: string): Promise<ReturnType<World[K]>> {
    await room.ready;
    if (room.closed) throw new Error('房间已关闭');
    const id = this.nextCommandId++;
    const accountId = connectionId ? this.options.resolveAccount?.(connectionId) : undefined;
    const message = {type: 'command', id, method, args,
      identity: connectionId && accountId ? {connectionId, accountId} : undefined} as RoomRequest;
    return new Promise((resolveResult, reject) => {
      room.pending.set(id, {resolve: value => resolveResult(value as ReturnType<World[K]>), reject});
      room.child.send(message, (error: Error | null) => {
        if (!error) return;
        room.pending.delete(id);
        reject(error);
        this.closeRoom(room, error);
      });
    });
  }

  private forward<K extends RoomCommand>(method: K) {
    return (...args: Parameters<World[K]>): Promise<ReturnType<World[K]>> => {
      const room = this.players.get(args[0] as string);
      if (!room) return Promise.reject(new Error('角色不存在'));
      return this.request(room, method, args);
    };
  }

  private notify<K extends RoomCommand>(room: RoomProcess, method: K, args: Parameters<World[K]>): void {
    void this.request(room, method, args).catch(error => {
      if (!room.closed) console.error(`Room ${room.roomId} ${method} failed`, error);
    });
  }

  private accountRooms(accountId: string): RoomProcess[] {
    const rooms = new Set<RoomProcess>();
    for (const [connectionId, session] of this.connections) {
      const room = this.rooms.get(session.roomId);
      if (room && this.options.resolveAccount?.(connectionId) === accountId) rooms.add(room);
    }
    return [...rooms];
  }

  async restorePlayerConnection(playerId: string, connectionId: string): Promise<void> {
    const room = this.players.get(playerId);
    if (!room) throw new Error('保留的角色已离开房间');
    await this.request(room, 'restorePlayerConnection', [playerId, connectionId], connectionId);
    for (const id of room.connectionIds) {
      if (this.connections.get(id)?.playerId === playerId) {
        this.connections.delete(id);
        room.connectionIds.delete(id);
      }
    }
    this.bindConnection(connectionId, {playerId, roomId: room.roomId,
      mode: room.summary!.mode, mapId: room.summary!.mapId});
  }

  async refreshAccountTitle(...args: Parameters<World['refreshAccountTitle']>): Promise<string[]> {
    return (await Promise.all(this.accountRooms(args[0]).map(room =>
      this.request(room, 'refreshAccountTitle', args)))).flat();
  }

  publishInventoryGrants(...args: Parameters<World['publishInventoryGrants']>): void {
    for (const room of this.accountRooms(args[0])) this.notify(room, 'publishInventoryGrants', args);
  }

  synchronizeInventoryRecord(...args: Parameters<World['synchronizeInventoryRecord']>): void {
    for (const room of this.accountRooms(args[0])) this.notify(room, 'synchronizeInventoryRecord', args);
  }

  publishReceipts(receipts: Parameters<World['publishReceipts']>[0]): void {
    for (const receipt of receipts) {
      const room = this.rooms.get(receipt.roomId);
      if (room) this.notify(room, 'publishReceipts', [[receipt]]);
    }
  }

  close(): void {
    for (const room of this.rooms.values()) this.closeRoom(room);
  }

  leave(playerId: string): Promise<WorldEvent[]> {
    const room = this.players.get(playerId);
    return room ? this.request(room, 'leave', [playerId]) : Promise.resolve([]);
  }

  pauseDisconnectedPlayer(playerId: string): Promise<void> {
    const room = this.players.get(playerId);
    return room ? this.request(room, 'pauseDisconnectedPlayer', [playerId]) : Promise.resolve();
  }

  canConfigureInventory(playerId: string): Promise<boolean> {
    const room = this.players.get(playerId);
    return room ? this.request(room, 'canConfigureInventory', [playerId]) : Promise.resolve(false);
  }

  updateInput(...args: Parameters<World['updateInput']>): Promise<WorldEvent[]> {
    const room = this.players.get(args[0]);
    return room ? this.request(room, 'updateInput', args) : Promise.resolve([]);
  }

  useAction(...args: Parameters<World['useAction']>): Promise<ReturnType<World['useAction']>> {
    const room = this.players.get(args[0]);
    return room ? this.request(room, 'useAction', args) : Promise.resolve(undefined);
  }

  chat(...args: Parameters<World['chat']>): Promise<WorldEvent[]> {
    const room = this.players.get(args[0]);
    return room ? this.request(room, 'chat', args) : Promise.resolve([]);
  }

  readonly manageCpu = this.forward('manageCpu');
  readonly configureAutopilot = this.forward('configureAutopilot');
  readonly ready = this.forward('ready');
  readonly resourcesLoaded = this.forward('resourcesLoaded');
  readonly changeTeam = this.forward('changeTeam');
  readonly kickRoomPlayer = this.forward('kickRoomPlayer');
  readonly editRoom = this.forward('editRoom');
  readonly rematch = this.forward('rematch');
  readonly exitPenaltyCount = this.forward('exitPenaltyCount');
  readonly playerInputSequence = this.forward('playerInputSequence');
  readonly bindAccountState = this.forward('bindAccountState');
  readonly bindInventory = this.forward('bindInventory');
  readonly bindRoleSources = this.forward('bindRoleSources');
  readonly bindEquipmentProfile = this.forward('bindEquipmentProfile');
  readonly bindTitle = this.forward('bindTitle');
  readonly inventory = this.forward('inventory');
  readonly selectTank = this.forward('selectTank');
  readonly confirmKitbag = this.forward('confirmKitbag');
}
