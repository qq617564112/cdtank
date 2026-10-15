import type {World} from '../../../server/src/world';
import type {TrainingCommand, TrainingPublication, TrainingReply, TrainingRequest} from './protocol';
import type {MsgRoomEvent} from '../../../shared/protocols';
import {loadTrainingMap} from './simulation-host';
import {newbornBattleSources} from '../../../shared/simulation/newborn-roles';

const TICK_MS = 50;
let world: World | undefined;
let roomId = '';
let playerId = '';
let nextInstanceId = 10;
let timer: ReturnType<typeof setInterval> | undefined;

function send(message: TrainingPublication): void {self.postMessage(message);}

function publish(events: MsgRoomEvent[] = []): void {
  const snapshot = world?.snapshot(roomId);
  if (!snapshot) return;
  snapshot.training = true;
  if (snapshot.roomInfo) {
    const info = snapshot.roomInfo;
    const description = `混战模式·${info.mapName}`;
    const suffix = ` · ${description}`;
    if (info.name === description) info.name = `训练模式·${info.mapName}`;
    else if (info.name.endsWith(suffix)) {
      info.name = `${info.name.slice(0, -suffix.length)} · 训练模式·${info.mapName}`;
    }
  }
  send({type: 'state', snapshot, events});
}

async function execute(command: TrainingCommand): Promise<TrainingReply> {
  if (command.type === 'create') {
    if (world) throw new Error('训练房间已创建');
    const options = command.options;
    await loadTrainingMap(options.mapId);
    const [{World: Simulation}, {content}] = await Promise.all([
      import('../../../server/src/world'), import('../../../server/src/content'),
    ]);
    roomId = `TRAINING-${Date.now().toString(36)}`;
    world = new Simulation(Date.now, {
      allocateRoomId: () => roomId,
      resolveAccount: connectionId => connectionId === 'TRAINING' ? 'TRAINING' : undefined,
      acquireOwnedItem: (_accountId, context) => {
        const item = world!.inventory(playerId).records.find(record => record.itemTableId === context.itemTableId);
        return item ? {...item, ownedQuantity: item.ownedQuantity + context.quantity}
          : {instanceId: nextInstanceId++, itemTableId: context.itemTableId, ownedQuantity: context.quantity,
            battleQuantity: 0, state: 0, field8: 0, float24Bits: 0, float28Bits: 0, float2cBits: 0};
      },
      discardOwnedItem: (_accountId, context) => {
        const item = world!.inventory(playerId).records.find(record => record.instanceId === context.instanceId);
        if (!item || item.itemTableId !== context.itemTableId || item.ownedQuantity !== context.expectedOwned) return;
        return item.ownedQuantity === 1 ? {deleted: true}
          : {deleted: false, remaining: {...item, ownedQuantity: item.ownedQuantity - 1}};
      },
    });
    const joined = world.createAndJoin('TRAINING', 4, options.mapId, options.roomName,
      options.name, options.tankId, '', options.minPlayers ?? 1, options.maxPlayers, false, options.timeLimitSeconds);
    playerId = joined.playerId;
    const tank = content.tanks.get(options.tankId)!;
    const pet = [...content.pets.values()][0];
    world.bindRoleSources(playerId, newbornBattleSources(tank, pet));
    const snapshot = world.snapshot(roomId)!;
    const join = {playerId, serverTime: snapshot.serverTime, room: {id: roomId,
      name: world.roomName(roomId), mode: 4, mapId: options.mapId, players: snapshot.players,
      phase: snapshot.phase, round: snapshot.match!.round}};
    timer = setInterval(() => {
      try {
        const result = world!.step(TICK_MS);
        publish(result.events);
      } catch (error) {
        clearInterval(timer);
        send({type: 'failure', error: error instanceof Error ? error.message : String(error)});
      }
    }, TICK_MS);
    return {join};
  }
  if (!world) throw new Error('训练尚未创建');
  switch (command.type) {
    case 'input': {
      const events = world.updateInput(playerId, command.input);
      if (events.length) publish(events);
      return {};
    }
    case 'action': publish(world.useAction(playerId, command.action)?.events); return {};
    case 'inventory': return {inventory: world.inventory(playerId)};
    case 'ready': {
      const request = command.request;
      if (request.resourcesLoaded) world.resourcesLoaded(playerId, request.round);
      else world.ready(playerId, request.round, request.isReady);
      break;
    }
    case 'cpu': {
      const request = command.request;
      world.manageCpu(playerId, request.round, request.operation, request.tankId,
        request.playerId, request.loadout, request.team);
      break;
    }
    case 'edit':
      if (command.request.mode !== 4 || command.request.password) throw new Error('训练仅支持本地混战');
      await loadTrainingMap(command.request.mapId);
      world.editRoom(playerId, command.request);
      break;
    case 'kick': publish(world.kickRoomPlayer(playerId, command.round, command.playerId).events); return {};
    case 'autopilot': world.configureAutopilot(playerId, command.round, command.enabled); break;
    case 'rematch': world.rematch(playerId, command.round); break;
  }
  publish();
  return {};
}

let commands = Promise.resolve();
self.onmessage = (event: MessageEvent<TrainingRequest>) => {
  const {id, command} = event.data;
  commands = commands.then(async () => {
    try {
      const result = await execute(command);
      if (id) send({type: 'reply', id, result});
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (id) send({type: 'reply', id, error: message});
      else send({type: 'failure', error: message});
    }
  });
};
