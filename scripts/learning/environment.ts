import {createInterface} from 'node:readline';
import {World} from '../../apps/server/src/world';
import {content} from '../../apps/server/src/content';
import {newbornBattleSources} from '../../apps/shared/simulation/newborn-roles';
import {getBattlefield} from '../../apps/server/src/battlefield';
import type {LearningGoal, LearningMemory} from '../../apps/server/src/learning/observation';

interface ResetRequest {
  type: 'reset';
  seed: number;
  mode?: number;
  mapId?: number;
  tankId?: number;
  players?: number;
  controlled?: number;
  seconds?: number;
  items?: {slot: number; itemTableId: number; quantity: number}[];
  lesson?: 'navigation' | 'combat';
}

interface StepRequest {type: 'step'; actions: number[][];}
type Frame = ReturnType<World['learningFrame']>;

let world: World;
let clock = 1_000_000;
let sequence = 0;
let roomId = '';
let playerIds: string[] = [];
let memories: (LearningMemory | undefined)[] = [];
let previous: Frame[] = [];
let seed = 0;
let mode = 4;
let lesson = 'combat';
let goal: LearningGoal | undefined;
let initialDistance = 1;
let decisions = 0;

function seededRandom(initial: number): () => number {
  let state = initial >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ state >>> 15, state | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

function frames(): Frame[] {
  const result = playerIds.map((id, index) => world.learningFrame(id, memories[index], goal));
  if (lesson === 'navigation') {
    for (const frame of result) {
      frame.actionMasks[3][1] = false;
      frame.actionMasks[4] = frame.actionMasks[4].map((_, index) => index === 0);
    }
  }
  memories = result.map(frame => frame.memory);
  return result;
}

function reset(request: ResetRequest) {
  seed = request.seed;
  Math.random = seededRandom(seed);
  clock = 1_000_000;
  sequence = 0;
  mode = request.mode ?? 4;
  lesson = request.lesson ?? 'combat';
  goal = undefined;
  decisions = 0;
  const mapId = request.mapId ?? 7;
  const count = request.players ?? 2;
  const controlled = request.controlled ?? 1;
  if (controlled < 1 || controlled > count) throw new Error('Invalid controlled player count');
  world = new World(() => clock, {allocateRoomId: () => 'LEARNING'});
  const joined = world.createAndJoin('LEARNER-0', mode, mapId, '学习', 'Learner 0',
    request.tankId ?? 1, '', 2, count, false, request.seconds ?? 60);
  roomId = joined.roomId;
  playerIds = [joined.playerId];
  for (let index = 1; index < controlled; index++) {
    playerIds.push(world.joinRoom(roomId, `LEARNER-${index}`, `Learner ${index}`, request.tankId ?? 1).playerId);
  }
  const tank = content.tanks.get(request.tankId ?? 1)!;
  const pet = [...content.pets.values()][0];
  for (const id of playerIds) {
    world.bindRoleSources(id, newbornBattleSources(tank, pet));
    const items = request.items ?? [];
    const hotkeys = Array<number>(7).fill(0);
    const records = items.map(item => {
      hotkeys[item.slot - 2] = item.slot;
      return {instanceId: item.slot, itemTableId: item.itemTableId,
        ownedQuantity: item.quantity, battleQuantity: item.quantity,
        state: 0, field8: 0, float24Bits: 0, float28Bits: 0, float2cBits: 0};
    });
    world.bindInventory(id, {hotkeys, records});
  }
  const stationaryIds: string[] = [];
  for (let index = controlled; index < count; index++) {
    if (lesson === 'navigation') {
      const idle = world.joinRoom(roomId, `IDLE-${index}`, `Idle ${index}`, request.tankId ?? 1);
      stationaryIds.push(idle.playerId);
      world.bindRoleSources(idle.playerId, newbornBattleSources(tank, pet));
    } else world.manageCpu(joined.playerId, 1, 'ADD', request.tankId ?? 1);
  }
  for (const id of [...playerIds, ...stationaryIds]) world.ready(id, 1);
  for (const id of [...playerIds, ...stationaryIds]) world.resourcesLoaded(id, 1);
  const snapshot = world.snapshot(roomId)!;
  if (snapshot.phase !== 'PLAYING') throw new Error(`Learning room failed to start: ${snapshot.phase}`);
  clock = snapshot.match!.battleStartsAt! + 50;
  world.step(50);
  for (const id of playerIds) {
    world.updateInput(id, {sequence: ++sequence, move: 0, turn: 0, aim: 0,
      fire: false, useItem: 1, clientTime: clock});
  }
  memories = playerIds.map(() => undefined);
  previous = frames();
  if (lesson === 'navigation') {
    const start = previous[0].memory;
    const field = getBattlefield(mapId);
    for (let attempt = 0; attempt < 64; attempt++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 60 + Math.random() * 120;
      const candidate = {x: start.x + Math.sin(angle) * radius, y: start.y,
        z: start.z + Math.cos(angle) * radius};
      const reached = field.move(start, candidate, 20);
      if (Math.hypot(reached.x - candidate.x, reached.z - candidate.z) < 1) {
        goal = candidate;
        break;
      }
    }
    if (!goal) throw new Error('No reachable movement lesson goal');
    initialDistance = Math.hypot(start.x - goal.x, start.z - goal.z);
    previous = frames();
  }
  return {type: 'reset', seed, mode, mapId, frames: previous, rewards: playerIds.map(() => 0), done: false};
}

function step(request: StepRequest) {
  if (!world) throw new Error('Reset the environment first');
  if (request.actions.length !== playerIds.length) throw new Error('Action count does not match actors');
  request.actions.forEach((action, index) => {
    if (action.length !== 5 || action.some((value, head) => !Number.isInteger(value)
        || value < 0 || value >= previous[index].actionSizes[head])) throw new Error('Invalid action');
    world.updateInput(playerIds[index], {sequence: ++sequence, move: action[0] - 1,
      turn: action[1] - 1, aim: action[2] - 1, fire: action[3] === 1,
      useItem: action[4], clientTime: clock});
  });
  for (let tick = 0; tick < 2; tick++) {clock += 50; world.step(50);}
  const current = frames();
  decisions++;
  const goalDistance = goal ? Math.hypot(current[0].memory.x - goal.x, current[0].memory.z - goal.z) : undefined;
  const success = goalDistance !== undefined && goalDistance < 20;
  const done = current[0].phase === 'FINISHED'
    || lesson === 'navigation' && (success || decisions >= 150);
  const rewards = current.map((frame, index) => {
    const before = previous[index].metrics, after = frame.metrics;
    const moved = Math.hypot(frame.memory.x - previous[index].memory.x,
      frame.memory.z - previous[index].memory.z);
    let reward = .002 * (after.damage - before.damage)
      - .001 * (after.damageTaken - before.damageTaken)
      + (after.kills - before.kills) - (after.deaths - before.deaths);
    if (mode === 2) reward += .004 * (after.bunkerDamage - before.bunkerDamage);
    if (mode === 3) reward += .004 * (after.vipDamage - before.vipDamage);
    if (mode === 5) reward += after.objectives - before.objectives;
    if (request.actions[index][0] !== 1 && frame.alive && moved < .2) reward -= .002;
    if (goal) {
      const beforeDistance = Math.hypot(previous[index].memory.x - goal.x, previous[index].memory.z - goal.z);
      const afterDistance = Math.hypot(frame.memory.x - goal.x, frame.memory.z - goal.z);
      reward += 4 * (beforeDistance - afterDistance) / initialDistance - .001;
      if (success) reward += 2;
    }
    if (done) {
      const result = frame.result?.players.find(player => player.id === playerIds[index]);
      if (result?.outcome === 'WIN') reward += 5;
      else if (result?.outcome === 'LOSE') reward -= 5;
    }
    return reward;
  });
  previous = current;
  return {type: 'step', seed, frames: current, rewards, done, lesson, success, goalDistance};
}

const lines = createInterface({input: process.stdin, crlfDelay: Infinity});
lines.on('line', line => {
  try {
    const request = JSON.parse(line) as ResetRequest | StepRequest;
    const result = request.type === 'reset' ? reset(request) : step(request);
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    process.stdout.write(`${JSON.stringify({type: 'error', error: error instanceof Error ? error.stack : String(error)})}\n`);
  }
});
