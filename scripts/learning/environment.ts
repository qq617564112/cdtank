import {createInterface} from 'node:readline';
import {World} from '../../apps/server/src/world';
import {content} from '../../apps/server/src/content';
import {newbornBattleSources} from '../../apps/shared/simulation/newborn-roles';
import {getBattlefield} from '../../apps/server/src/battlefield';
import {createOriginalBotNavigation} from '../../apps/server/src/battle/cpu/original-navigation';
import {findBotPath} from '../../apps/server/src/battle/cpu/navigation';
import {rangeLessonLanes} from './range-lanes';
import type {LearningGoal, LearningMemory} from '../../apps/server/src/learning/observation';
import type {WorldEvent} from '../../apps/server/src/world';

interface ResetRequest {
  type: 'reset';
  seed: number;
  mode?: number;
  mapId?: number;
  tankId?: number;
  ammoId?: number;
  players?: number;
  controlled?: number;
  seconds?: number;
  items?: {slot: number; itemTableId: number; quantity: number}[];
  lesson?: 'turning' | 'navigation' | 'aiming' | 'shooting' | 'dodge' | 'range' | 'items' | 'combat';
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
let rangeShots = 0;
let outsideRangeShots = 0;
let rangeTicks = 0;
let rangeStreak = 0;
let rangeKills = 0;
let headingStreak = 0;
let lessonRange = 0;
let lessonAmmoId = 2001;
let lessonMaximumHp = 1;
let consumedItems = 0;
let rejectedItems = 0;
let healedHp = 0;
let practiceBearing = new Map<string, number>();
let teamMetrics: ReturnType<World['learningCentralState']>['teamMetrics'];
let actorItemMetrics: {consumedItems: number; rejectedItems: number; healedHp: number}[] = [];

function rangeError(distance: number, range: number): number {
  return Math.max(0, .75 * range - distance, distance - .9 * range);
}

function headingCosine(frame: Frame): number {
  if (!goal) return 0;
  const dx = goal.x - frame.memory.x, dz = goal.z - frame.memory.z;
  const distance = Math.hypot(dx, dz);
  return (dx * frame.observation[0] + dz * frame.observation[1]) / Math.max(1, distance);
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

function frames(events: readonly WorldEvent[] = []): Frame[] {
  const result = playerIds.map((id, index) => world.learningFrame(id, memories[index], goal, events));
  if (lesson === 'navigation' || lesson === 'turning') {
    for (const frame of result) {
      frame.actionMasks[2] = [false, true, false];
      if (level === 0) frame.actionMasks[1] = [false, true, false];
      if (lesson === 'turning') {
        frame.actionMasks[0] = [false, true, false];
        frame.actionMasks[1] = [true, true, true];
      }
      frame.actionMasks[3][1] = false;
      frame.actionMasks[4] = frame.actionMasks[4].map((_, index) => index === 0);
    }
  }
  if (lesson === 'aiming' || lesson === 'shooting' || lesson === 'dodge') {
    for (const frame of result) {
      frame.actionMasks[4] = frame.actionMasks[4].map((_, index) => index === 0);
      if (lesson === 'dodge') {
        frame.actionMasks[2] = [false, true, false];
        frame.actionMasks[3][1] = false;
      }
      if (lesson === 'aiming' || lesson === 'shooting' && level === 0) {
        frame.actionMasks[0] = [false, true, false];
        frame.actionMasks[1] = [false, true, false];
      }
    }
  }
  if (lesson === 'range') {
    for (const frame of result) {
      frame.actionMasks[4] = frame.actionMasks[4].map((_, index) => index === 0);
      if (frame.weapon.ammoId !== lessonAmmoId) frame.actionMasks[3][1] = false;
      if (level < 2) {
        frame.actionMasks[1] = [false, true, false];
        frame.actionMasks[2] = [false, true, false];
        frame.actionMasks[3][1] = false;
      }
    }
  }
  if (lesson === 'items' && level < 3) {
    for (const frame of result) {
      if (level < 2) frame.actionMasks[0] = [false, true, false];
      frame.actionMasks[1] = [false, true, false];
      frame.actionMasks[2] = [false, true, false];
      frame.actionMasks[3][1] = false;
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
  rangeShots = 0;
  outsideRangeShots = 0;
  rangeTicks = 0;
  rangeStreak = 0;
  rangeKills = 0;
  headingStreak = 0;
  lessonRange = 0;
  lessonAmmoId = request.ammoId ?? 2001;
  consumedItems = 0;
  rejectedItems = 0;
  healedHp = 0;
  practiceBearing = new Map();
  const requestedMapId = request.mapId ?? 7;
  const count = request.players ?? 2;
  const controlled = request.controlled ?? 1;
  if (!Number.isInteger(count) || count < 2 || count > 6
      || !Number.isInteger(controlled) || controlled < 1 || controlled > count) {
    throw new Error('Learning requires two to six players and a valid controlled count');
  }
  if (lesson !== 'combat' && controlled !== 1) throw new Error('Primitive lessons control one actor');
  if (mode <= 3 && controlled !== count && controlled > Math.ceil(count / 2)) {
    throw new Error('Team learning controls one side or the entire roster');
  }
  world = new World(() => clock, {allocateRoomId: () => 'LEARNING'});
  const joined = world.createAndJoin('LEARNER-0', mode, requestedMapId, '学习', 'Learner 0',
    request.tankId ?? 1, '', count, count, false, request.seconds ?? 60);
  const mapId = joined.mapId;
  roomId = joined.roomId;
  playerIds = [joined.playerId];
  const stationaryIds: string[] = [];
  for (let seat = 1; seat < count; seat++) {
    // Alternating admission keeps a complete learned side together without team swaps.
    const learned = playerIds.length < controlled
      && (mode > 3 || controlled === count || seat % 2 === 0);
    if (learned) {
      const index = playerIds.length;
      playerIds.push(world.joinRoom(roomId, `LEARNER-${index}`, `Learner ${index}`, request.tankId ?? 1).playerId);
    } else if (lesson !== 'combat') {
      const idle = world.joinRoom(roomId, `IDLE-${seat}`, `Idle ${seat}`, request.tankId ?? 1);
      stationaryIds.push(idle.playerId);
      practiceIds.push(idle.playerId);
    } else world.manageCpu(joined.playerId, 1, 'ADD', request.tankId ?? 1);
  }
  if (playerIds.length !== controlled) throw new Error('Learning roster did not fill controlled seats');
  const tank = content.tanks.get(request.tankId ?? 1)!;
  const ammo = content.items.get(request.ammoId ?? 2001);
  if (!ammo || ammo.kind !== 'ammo') throw new Error('Unknown practice ammunition');
  const pet = [...content.pets.values()][0];
  for (const id of playerIds) {
    world.bindRoleSources(id, newbornBattleSources(tank, pet));
    const lessonItems = lesson !== 'items' ? [] : level === 0 ? [{slot: 5, itemTableId: 2, quantity: 1}]
      : level === 1 ? [{slot: 5, itemTableId: 8, quantity: 1}]
      : level === 2 ? [{slot: 5, itemTableId: 6, quantity: 1}]
      : [{slot: 5, itemTableId: 2, quantity: 1}, {slot: 6, itemTableId: 8, quantity: 1},
        {slot: 7, itemTableId: 6, quantity: 1}, {slot: 8, itemTableId: 4, quantity: 1}];
    const items = request.items ?? [...lessonItems, ...(ammo.runtime.defaultAmmo ? []
      : [{slot: 2, itemTableId: ammo.id, quantity: ammo.battleUseMax}])];
    const hotkeys = Array<number>(7).fill(0);
    const records = items.map(item => {
      hotkeys[item.slot - 2] = item.slot;
      return {instanceId: item.slot, itemTableId: item.itemTableId,
        ownedQuantity: item.quantity, battleQuantity: item.quantity,
        state: 0, field8: 0, float24Bits: 0, float28Bits: 0, float2cBits: 0};
    });
    world.bindInventory(id, {hotkeys, records});
  }
  for (const id of stationaryIds) world.bindRoleSources(id, newbornBattleSources(tank, pet));
  for (const id of [...playerIds, ...stationaryIds]) world.ready(id, 1);
  for (const id of [...playerIds, ...stationaryIds]) world.resourcesLoaded(id, 1);
  const snapshot = world.snapshot(roomId)!;
  if (snapshot.phase !== 'PLAYING') throw new Error(`Learning room failed to start: ${snapshot.phase}`);
  clock = snapshot.match!.battleStartsAt! + 50;
  world.step(50);
  for (const id of playerIds) {
    world.updateInput(id, {sequence: ++sequence, move: 0, turn: 0, aim: 0,
      fire: false, useItem: ammo.runtime.defaultAmmo ? 1 : 2, clientTime: clock});
  }
  memories = playerIds.map(() => undefined);
  previous = frames();
  lessonMaximumHp = world.snapshot(roomId)!.players.find(player => player.id === playerIds[0])!.maxHp;
  if (lesson === 'aiming' || lesson === 'shooting' || lesson === 'dodge' || lesson === 'items' && level !== 2) {
    if (controlled !== 1 || practiceIds.length !== 1 || mode !== 4) {
      throw new Error('Target lessons require one learner and one practice actor in mode 4');
    }
    const learner = world.snapshot(roomId)!.players.find(player => player.id === playerIds[0])!;
    const field = getBattlefield(mapId);
    const navigation = createOriginalBotNavigation(field);
    let placed = false;
    for (let attempt = 0; attempt < 128; attempt++) {
      const angle = learner.yaw + (Math.random() * 2 - 1)
        * (lesson === 'aiming' ? [.25, .8, Math.PI, Math.PI][level] : level === 0 ? .25 : Math.PI);
      const radius = lesson === 'dodge' ? [400, 300, 200, 90][level] + Math.random() * [200, 200, 150, 270][level]
        : 90 + Math.random() * (level === 0 ? 60 : 270);
      const x = learner.x + Math.sin(angle) * radius, z = learner.z + Math.cos(angle) * radius;
      const y = field.navigation.groundHeightAt(x, z);
      if (y === undefined) continue;
      const candidate = {x, y, z};
      if (!navigation.canTraverse(learner, candidate)
          || field.firstSurfaceHit({...learner, y: learner.y + 20}, {...candidate, y: y + 20}, 0)) continue;
      const moving = lesson === 'shooting' && level >= 2 || lesson === 'aiming' && level === 3
        || lesson === 'items' && level === 3;
      const facing = moving ? angle + Math.PI / 2 : angle + Math.PI;
      if (!world.placeLearningActor(practiceIds[0], {...candidate, yaw: facing,
        hp: lesson !== 'items' && level === 0 ? 150 : 600})) continue;
      const hp = lesson === 'items' && (level === 0 || level === 3)
        ? learner.maxHp * (.5 + .5 * Math.random()) : learner.maxHp;
      placed = world.placeLearningActor(playerIds[0], {...learner, hp});
      if (placed) break;
    }
    if (!placed) throw new Error('No visible target lesson placement');
    memories = playerIds.map(() => undefined);
    previous = frames();
  }
  if (lesson === 'items' && level === 2) {
    if (controlled !== 1 || practiceIds.length !== 1 || mode !== 4) {
      throw new Error('Item lessons require one learner and one practice actor in mode 4');
    }
    const lanes = rangeLessonLanes(getBattlefield(mapId), 1000, 1);
    const offset = Math.floor(Math.random() * lanes.length);
    let placed = false;
    for (let attempt = 0; attempt < lanes.length; attempt++) {
      const lane = lanes[(offset + attempt) % lanes.length];
      if (!world.placeLearningActor(playerIds[0], {...lane.start, yaw: lane.yaw, hp: lessonMaximumHp})) continue;
      if (!world.placeLearningActor(practiceIds[0], {...lane.target, yaw: lane.yaw + Math.PI, hp: 600})) continue;
      goal = {x: lane.start.x + Math.sin(lane.yaw) * 200,
        z: lane.start.z + Math.cos(lane.yaw) * 200};
      initialDistance = 200;
      placed = true;
      break;
    }
    if (!placed) throw new Error('No item movement lesson corridor');
    memories = playerIds.map(() => undefined);
    previous = frames();
  }
  if (lesson === 'range') {
    if (controlled !== 1 || practiceIds.length !== 1 || mode !== 4) {
      throw new Error('Range lessons require one learner and one practice actor in mode 4');
    }
    const learner = world.snapshot(roomId)!.players.find(player => player.id === playerIds[0])!;
    const field = getBattlefield(mapId);
    const range = previous[0].weapon.range;
    lessonRange = range;
    const lanes = rangeLessonLanes(field, range, level);
    const offset = Math.floor(Math.random() * lanes.length);
    let placed = false;
    for (let attempt = 0; attempt < lanes.length; attempt++) {
      const lane = lanes[(offset + attempt) % lanes.length];
      if (!world.placeLearningActor(playerIds[0], {...lane.start, yaw: lane.yaw, hp: learner.maxHp})) continue;
      if (!world.placeLearningActor(practiceIds[0], {...lane.target, yaw: lane.yaw + Math.PI, hp: 150})) continue;
      placed = true;
      break;
    }
    if (!placed) throw new Error('No clear range lesson placement on this map');
    memories = playerIds.map(() => undefined);
    previous = frames();
    const target = world.snapshot(roomId)!.players.find(player => player.id === practiceIds[0])!;
    initialDistance = Math.hypot(target.x - previous[0].memory.x, target.z - previous[0].memory.z);
  }
  if (lesson === 'navigation' || lesson === 'turning') {
    const start = previous[0].memory;
    const field = getBattlefield(mapId);
    const navigation = createOriginalBotNavigation(field);
    const heading = Math.atan2(previous[0].observation[0], previous[0].observation[1]);
    for (let attempt = 0; attempt < 128; attempt++) {
      const angle = heading + (Math.random() * 2 - 1)
        * (lesson === 'turning' ? [.4, .8, Math.PI, Math.PI][level] : [0.15, 0.8, Math.PI, Math.PI][level]);
      const radius = lesson === 'navigation' && level === 3 ? 200 + Math.random() * 300
        : 60 + Math.random() * [60, 100, 180, 180][level];
      const candidate = {x: start.x + Math.sin(angle) * radius, y: start.y,
        z: start.z + Math.cos(angle) * radius};
      const direct = navigation.canTraverse(start, candidate);
      if (lesson === 'turning' || level < 3 ? direct
          : !direct && findBotPath(field, start, candidate, navigation).length > 1) {
        goal = candidate;
        break;
      }
    }
    if (!goal) throw new Error('No reachable movement lesson goal');
    initialDistance = Math.hypot(start.x - goal.x, start.z - goal.z);
    previous = frames();
  }
  const central = world.learningCentralState(roomId, playerIds);
  teamMetrics = central.teamMetrics;
  actorItemMetrics = playerIds.map(() => ({consumedItems: 0, rejectedItems: 0, healedHp: 0}));
  return {type: 'reset', seed, mode, mapId, lesson, level, frames: previous,
    criticStates: central.criticStates,
    actors: world.snapshot(roomId)!.players.map(player => ({id: player.id, team: player.team,
      learned: playerIds.includes(player.id), cpu: !!player.isCpu})),
    rewards: playerIds.map(() => 0), done: false, initialDistance};
}

function step(request: StepRequest) {
  if (!world) throw new Error('Reset the environment first');
  if (request.actions.length !== playerIds.length) throw new Error('Action count does not match actors');
  const events: WorldEvent[] = [];
  let rangeKillDelta = 0;
  let rangeShotDelta = 0;
  let outsideRangeShotDelta = 0;
  let aimedRangeShotDelta = 0;
  request.actions.forEach((action, index) => {
    if (action.length !== 5 || action.some((value, head) => !Number.isInteger(value)
        || value < 0 || value >= previous[index].actionSizes[head])) throw new Error('Invalid action');
    events.push(...world.updateInput(playerIds[index], {sequence: ++sequence, move: action[0] - 1,
      turn: action[1] - 1, aim: action[2] - 1, fire: action[3] === 1,
      useItem: action[4], clientTime: clock}));
  });
  if (lesson === 'shooting' && level >= 2 || lesson === 'aiming' && level === 3
      || lesson === 'dodge' || lesson === 'range' && level === 3 || lesson === 'items' && level !== 2) {
    for (const id of practiceIds) {
      const actor = world.snapshot(roomId)!.players.find(player => player.id === id)!;
      const learner = previous[0].memory;
      const reactionTicks = lesson === 'dodge' ? [10, 5, 2, 1][level] : 1;
      if (decisions % reactionTicks === 0 || !practiceBearing.has(id)) {
        practiceBearing.set(id, Math.atan2(learner.x - actor.x, learner.z - actor.z));
      }
      const bearing = practiceBearing.get(id)!;
      const error = Math.atan2(Math.sin(bearing - actor.yaw - actor.aim), Math.cos(bearing - actor.yaw - actor.aim));
      const shootsBack = lesson === 'dodge' || (lesson === 'shooting' || lesson === 'range') && level === 3
        || lesson === 'items';
      const moving = lesson === 'shooting' || lesson === 'aiming' || lesson === 'items' && level === 3;
      const fireWindow = lesson === 'dodge' ? decisions >= [15, 10, 5, 0][level]
        : lesson !== 'items' || level === 3 || (level === 0 ? [30, 80] : [50, 80]).includes(decisions);
      events.push(...world.updateInput(id, {sequence: ++sequence, move: moving ? (decisions % 30 < 15 ? 1 : -1) : 0,
        turn: 0, aim: shootsBack ? Math.sign(error) : 0,
        fire: shootsBack && fireWindow && Math.abs(error) < .1, useItem: 0, clientTime: clock}));
    }
  }
  for (let tick = 0; tick < 2; tick++) {
    clock += 50;
    const advanced = world.step(50);
    events.push(...advanced.events);
    if (lesson === 'range') {
      const fired = advanced.events.filter(event => event.type === 'fire' && event.playerId === playerIds[0]);
      if (fired.length) {
        const target = world.snapshot(roomId)!.players.find(player => player.id === practiceIds[0])!;
        for (const event of fired) {
          const distance = Math.hypot(target.x - event.x, target.z - event.z);
          if (rangeError(distance, lessonRange) === 0) {
            rangeShotDelta++;
            if (event.targetId === target.id) aimedRangeShotDelta++;
          }
          if (distance > lessonRange) outsideRangeShotDelta++;
        }
      }
    }
    const kills = advanced.events.filter(event => event.type === 'destroy'
      && event.playerId === playerIds[0] && practiceIds.includes(event.targetId));
    if (lesson === 'range' && kills.length) {
      const learner = world.snapshot(roomId)!.players.find(player => player.id === playerIds[0])!;
      rangeKillDelta += kills.filter(event => rangeError(
        Math.hypot(event.x - learner.x, event.z - learner.z), lessonRange) === 0).length;
    }
  }
  rangeKills += rangeKillDelta;
  rangeShots += rangeShotDelta;
  outsideRangeShots += outsideRangeShotDelta;
  const current = frames(events);
  const central = world.learningCentralState(roomId, playerIds);
  decisions++;
  for (let index = 0; index < playerIds.length; index++) {
    const uses = events.filter(event => event.type === 'itemUsed' && event.playerId === playerIds[index]);
    actorItemMetrics[index].consumedItems += uses.length;
    actorItemMetrics[index].rejectedItems += events.filter(event => event.type === 'itemRejected'
      && event.playerId === playerIds[index]).length;
    actorItemMetrics[index].healedHp += uses.reduce((total, event) => total +
      (event.skillId !== undefined && content.skills.get(event.skillId)?.functions[0]?.type === 2 ? event.value : 0), 0);
  }
  const usedItems = events.filter(event => event.type === 'itemUsed' && event.playerId === playerIds[0]);
  const healingDelta = usedItems.reduce((total, event) => total +
    (event.skillId !== undefined && content.skills.get(event.skillId)?.functions[0]?.type === 2 ? event.value : 0), 0);
  const rejectedDelta = events.filter(event => event.type === 'itemRejected' && event.playerId === playerIds[0]).length;
  consumedItems += usedItems.length;
  rejectedItems += rejectedDelta;
  healedHp += healingDelta;
  const target = lesson === 'range' ? world.snapshot(roomId)!.players.find(player => player.id === practiceIds[0]) : undefined;
  const targetDistance = target ? Math.hypot(target.x - current[0].memory.x, target.z - current[0].memory.z) : undefined;
  const inBand = targetDistance !== undefined && rangeError(targetDistance, lessonRange) === 0;
  if (inBand) rangeTicks++;
  rangeStreak = inBand ? rangeStreak + 1 : 0;
  const goalDistance = goal ? Math.hypot(current[0].memory.x - goal.x, current[0].memory.z - goal.z) : undefined;
  const headingError = goal ? Math.acos(Math.max(-1, Math.min(1, headingCosine(current[0])))) : undefined;
  headingStreak = headingError !== undefined && headingError < .08 ? headingStreak + 1 : 0;
  const success = lesson === 'navigation' ? goalDistance !== undefined && goalDistance < 20
    : lesson === 'turning' ? headingStreak >= 5
    : lesson === 'shooting' || lesson === 'aiming' ? current[0].metrics.kills > 0
    : lesson === 'range' ? level < 2 ? rangeStreak >= 50 : rangeKills > 0
    : lesson === 'dodge' ? decisions >= 150 && current[0].metrics.damageTaken === 0
    : lesson === 'items' ? current[0].alive && (level === 0
      ? decisions >= 150 && current[0].metrics.hp >= .75 * lessonMaximumHp
      : level === 1 ? decisions >= 150 && current[0].metrics.damageTaken === 0
      : level === 2 ? goalDistance !== undefined && goalDistance < 20 : current[0].metrics.kills > 0)
    : current[0].result?.players.find(player => player.id === playerIds[0])?.outcome === 'WIN';
  const done = current[0].phase === 'FINISHED'
    || lesson === 'navigation' && (success || decisions >= (level === 3 ? 300 : 150))
    || lesson === 'turning' && (success || decisions >= 100)
    || (lesson === 'shooting' || lesson === 'aiming') && (success || decisions >= 200)
    || lesson === 'range' && (success || decisions >= 300)
    || lesson === 'dodge' && (current[0].metrics.deaths > 0 || decisions >= 150)
    || lesson === 'items' && (success || current[0].metrics.deaths > 0 || decisions >= (level === 2 ? 100 : level === 3 ? 300 : 150));
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
      + (lesson === 'range' ? rangeKillDelta : after.kills - before.kills) - (after.deaths - before.deaths);
    if (mode === 2) reward += .004 * (after.bunkerDamage - before.bunkerDamage);
    if (mode === 3) reward += .004 * (after.vipDamage - before.vipDamage);
    if (mode === 5) reward += after.objectives - before.objectives;
    if (lesson === 'combat' && mode <= 3) {
      const team = after.team;
      const oldTeam = teamMetrics[team], newTeam = central.teamMetrics[team];
      let shared = .002 * (newTeam.damage - oldTeam.damage)
        - .001 * (newTeam.damageTaken - oldTeam.damageTaken)
        + newTeam.kills - oldTeam.kills - (newTeam.deaths - oldTeam.deaths);
      if (mode === 2) shared += .004 * (newTeam.bunkerDamage - oldTeam.bunkerDamage);
      if (mode === 3) shared += .004 * (newTeam.vipDamage - oldTeam.vipDamage);
      reward = .25 * reward + .75 * shared;
    }
    if (lesson === 'combat') {
      reward -= .02 * events.filter(event => event.type === 'itemUsed' && event.playerId === playerIds[index]).length;
      reward -= .01 * events.filter(event => event.type === 'itemRejected' && event.playerId === playerIds[index]).length;
    }
    if (request.actions[index][0] !== 1 && frame.alive && moved < .2) reward -= .002;
    if (lesson === 'shooting' || lesson === 'aiming') {
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
    if (lesson === 'items') {
      reward += .003 * healingDelta - (level === 2 ? .005 : .05) * usedItems.length
        - .02 * rejectedDelta - .003;
      if (success && !goal) reward += 2;
    }
    if (lesson === 'range' && target && targetDistance !== undefined) {
      const beforeDistance = Math.hypot(target.x - previous[index].memory.x, target.z - previous[index].memory.z);
      reward += 4 * (rangeError(beforeDistance, lessonRange)
        - rangeError(targetDistance, lessonRange)) / Math.max(1, lessonRange) - .001;
      if (inBand) reward += .01;
      reward -= .03 * outsideRangeShotDelta;
      reward += .03 * aimedRangeShotDelta;
      if (success) reward += 2;
    }
    if (goal && lesson === 'turning') {
      reward += 2 * (headingCosine(frame) - headingCosine(previous[index])) - .001;
      if (headingError !== undefined && headingError < .08) reward += .02;
      if (success) reward += 2;
    } else if (goal) {
      const beforeDistance = Math.hypot(previous[index].memory.x - goal.x, previous[index].memory.z - goal.z);
      const afterDistance = Math.hypot(frame.memory.x - goal.x, frame.memory.z - goal.z);
      reward += 4 * (beforeDistance - afterDistance) / initialDistance - .001;
      reward += .25 * (Math.abs(headingCosine(frame)) - Math.abs(headingCosine(previous[index])));
      if (success) reward += 2;
    }
    if (done) {
      const result = frame.result?.players.find(player => player.id === playerIds[index]);
      if (result?.outcome === 'WIN') reward += 5;
      else if (result?.outcome === 'LOSE') reward -= 5;
    }
    return reward;
  });
  teamMetrics = central.teamMetrics;
  previous = current;
  return {type: 'step', seed, frames: current, criticStates: central.criticStates,
    rewards, done, lesson, level, success, goalDistance,
    outcomes: playerIds.map(id => current[0].result?.players.find(player => player.id === id)?.outcome ?? null),
    actorItemMetrics, teamMetrics,
    lessonMetrics: {initialDistance, goalDistance, travelled, blocked, decisions,
      targetDistance, weaponRange: lesson === 'range' ? lessonRange : current[0].weapon.range,
      currentWeaponRange: current[0].weapon.range, rangeTicks, rangeStreak,
      rangeShots, outsideRangeShots, rangeKills, headingError, headingStreak,
      consumedItems, rejectedItems, healedHp, finalHp: current[0].metrics.hp}};
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
