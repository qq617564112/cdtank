import {createInterface} from 'node:readline';
import {World} from '../../apps/server/src/world';
import {content} from '../../apps/server/src/content';
import {newbornBattleSources} from '../../apps/shared/simulation/newborn-roles';
import {getBattlefield} from '../../apps/server/src/battlefield';
import {createOriginalBotNavigation} from '../../apps/server/src/battle/cpu/original-navigation';
import {findBotPath} from '../../apps/server/src/battle/cpu/navigation';
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
  lesson?: 'navigation' | 'shooting' | 'dodge' | 'combat';
  level?: number;
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
let level = 1;
let blocked = 0;
let travelled = 0;
let practiceIds: string[] = [];

function alignment(frame: Frame): number {
  if (!goal) return 0;
  const dx = goal.x - frame.memory.x, dz = goal.z - frame.memory.z;
  const distance = Math.hypot(dx, dz);
  return Math.abs((dx * frame.observation[0] + dz * frame.observation[1]) / Math.max(1, distance));
}

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
      frame.actionMasks[2] = [false, true, false];
      if (level === 0) frame.actionMasks[1] = [false, true, false];
      frame.actionMasks[3][1] = false;
      frame.actionMasks[4] = frame.actionMasks[4].map((_, index) => index === 0);
    }
  }
  if (lesson === 'shooting' || lesson === 'dodge') {
    for (const frame of result) {
      frame.actionMasks[4] = frame.actionMasks[4].map((_, index) => index === 0);
      if (lesson === 'dodge') {
        frame.actionMasks[2] = [false, true, false];
        frame.actionMasks[3][1] = false;
      }
      if (lesson === 'shooting' && level === 0) {
        frame.actionMasks[0] = [false, true, false];
        frame.actionMasks[1] = [false, true, false];
      }
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
  level = request.level ?? 1;
  if (!Number.isInteger(level) || level < 0 || level > 3) throw new Error('Invalid curriculum level');
  goal = undefined;
  decisions = 0;
  blocked = 0;
  travelled = 0;
  initialDistance = 1;
  practiceIds = [];
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
    if (lesson !== 'combat') {
      const idle = world.joinRoom(roomId, `IDLE-${index}`, `Idle ${index}`, request.tankId ?? 1);
      stationaryIds.push(idle.playerId);
      practiceIds.push(idle.playerId);
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
  if (lesson === 'shooting' || lesson === 'dodge') {
    if (controlled !== 1 || practiceIds.length !== 1 || mode !== 4) {
      throw new Error('Target lessons require one learner and one practice actor in mode 4');
    }
    const learner = world.snapshot(roomId)!.players.find(player => player.id === playerIds[0])!;
    const field = getBattlefield(mapId);
    const navigation = createOriginalBotNavigation(field);
    let placed = false;
    for (let attempt = 0; attempt < 128; attempt++) {
      const angle = learner.yaw + (Math.random() * 2 - 1) * (level === 0 ? .25 : Math.PI);
      const radius = 90 + Math.random() * (level === 0 ? 60 : 270);
      const candidate = {x: learner.x + Math.sin(angle) * radius, y: learner.y,
        z: learner.z + Math.cos(angle) * radius};
      if (!navigation.canTraverse(learner, candidate)
          || field.firstSurfaceHit({...learner, y: learner.y + 20}, {...candidate, y: candidate.y + 20}, 0)) continue;
      const facing = lesson === 'shooting' && level >= 2 ? angle + Math.PI / 2 : angle + Math.PI;
      if (!world.placeLearningActor(practiceIds[0], {...candidate, yaw: facing, hp: level === 0 ? 150 : 600})) continue;
      placed = world.placeLearningActor(playerIds[0], {...learner, hp: learner.maxHp});
      if (placed) break;
    }
    if (!placed) throw new Error('No visible target lesson placement');
    memories = playerIds.map(() => undefined);
    previous = frames();
  }
  if (lesson === 'navigation') {
    const start = previous[0].memory;
    const field = getBattlefield(mapId);
    const navigation = createOriginalBotNavigation(field);
    const heading = Math.atan2(previous[0].observation[0], previous[0].observation[1]);
    for (let attempt = 0; attempt < 128; attempt++) {
      const angle = heading + (Math.random() * 2 - 1) * [0.15, 0.8, Math.PI, Math.PI][level];
      const radius = level === 3 ? 200 + Math.random() * 300 : 60 + Math.random() * [60, 100, 180][level];
      const candidate = {x: start.x + Math.sin(angle) * radius, y: start.y,
        z: start.z + Math.cos(angle) * radius};
      const direct = navigation.canTraverse(start, candidate);
      if (level < 3 ? direct : !direct && findBotPath(field, start, candidate, navigation).length > 1) {
        goal = candidate;
        break;
      }
    }
    if (!goal) throw new Error('No reachable movement lesson goal');
    initialDistance = Math.hypot(start.x - goal.x, start.z - goal.z);
    previous = frames();
  }
  return {type: 'reset', seed, mode, mapId, level, frames: previous,
    rewards: playerIds.map(() => 0), done: false, initialDistance};
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
  if (lesson === 'shooting' && level >= 2 || lesson === 'dodge') {
    for (const id of practiceIds) {
      const actor = world.snapshot(roomId)!.players.find(player => player.id === id)!;
      const learner = previous[0].memory;
      const error = Math.atan2(Math.sin(Math.atan2(learner.x - actor.x, learner.z - actor.z) - actor.yaw - actor.aim),
        Math.cos(Math.atan2(learner.x - actor.x, learner.z - actor.z) - actor.yaw - actor.aim));
      const shootsBack = lesson === 'dodge' || level === 3;
      world.updateInput(id, {sequence: ++sequence, move: lesson === 'shooting' ? (decisions % 30 < 15 ? 1 : -1) : 0,
        turn: 0, aim: shootsBack ? Math.sign(error) : 0,
        fire: shootsBack && Math.abs(error) < .1, useItem: 0, clientTime: clock});
    }
  }
  for (let tick = 0; tick < 2; tick++) {clock += 50; world.step(50);}
  const current = frames();
  decisions++;
  const goalDistance = goal ? Math.hypot(current[0].memory.x - goal.x, current[0].memory.z - goal.z) : undefined;
  const success = lesson === 'navigation' ? goalDistance !== undefined && goalDistance < 20
    : lesson === 'shooting' ? current[0].metrics.kills > 0
    : lesson === 'dodge' ? decisions >= 150 && current[0].metrics.damageTaken === 0 : false;
  const done = current[0].phase === 'FINISHED'
    || lesson === 'navigation' && (success || decisions >= (level === 3 ? 300 : 150))
    || lesson === 'shooting' && (success || decisions >= 200)
    || lesson === 'dodge' && (current[0].metrics.deaths > 0 || decisions >= 150);
  const rewards = current.map((frame, index) => {
    const before = previous[index].metrics, after = frame.metrics;
    const moved = Math.hypot(frame.memory.x - previous[index].memory.x,
      frame.memory.z - previous[index].memory.z);
    if (index === 0) {
      travelled += moved;
      if (request.actions[index][0] !== 1 && frame.alive && moved < .2) blocked++;
    }
    let reward = .002 * (after.damage - before.damage)
      - .001 * (after.damageTaken - before.damageTaken)
      + (after.kills - before.kills) - (after.deaths - before.deaths);
    if (mode === 2) reward += .004 * (after.bunkerDamage - before.bunkerDamage);
    if (mode === 3) reward += .004 * (after.vipDamage - before.vipDamage);
    if (mode === 5) reward += after.objectives - before.objectives;
    if (request.actions[index][0] !== 1 && frame.alive && moved < .2) reward -= .002;
    if (lesson === 'shooting') {
      const aimPotential = (value: Frame) => {
        if (!value.observation[24]) return 0;
        const angle = Math.atan2(value.observation[25], value.observation[26]);
        const turret = Math.atan2(value.observation[4], value.observation[5]);
        return Math.cos(angle - turret);
      };
      reward += .25 * (aimPotential(frame) - aimPotential(previous[index])) - .001;
      if (success) reward += 2;
    }
    if (lesson === 'dodge') reward += .002 - .003 * (after.damageTaken - before.damageTaken);
    if (goal) {
      const beforeDistance = Math.hypot(previous[index].memory.x - goal.x, previous[index].memory.z - goal.z);
      const afterDistance = Math.hypot(frame.memory.x - goal.x, frame.memory.z - goal.z);
      reward += 4 * (beforeDistance - afterDistance) / initialDistance - .001;
      reward += .25 * (alignment(frame) - alignment(previous[index]));
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
  return {type: 'step', seed, frames: current, rewards, done, lesson, level, success, goalDistance,
    lessonMetrics: {initialDistance, goalDistance, travelled, blocked, decisions}};
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
