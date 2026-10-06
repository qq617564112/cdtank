import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import type {PlaySkillEffectMessage, StopSkillEffectMessage} from '../apps/shared/protocols/MsgRoomEvent';
import {SkillEffectNotificationRecord, SkillEffectNotifications} from '../apps/web/src/match/skills/skill-effect-notifications';

interface Event {kind: string; [key: string]: unknown;}
type Action = (PlaySkillEffectMessage & {kind: 'play'}) |
  (StopSkillEffectMessage & {kind: 'stop'}) | {kind: 'update'; argument: number};
interface State {accumulator: number; records: number[][]; queues: {roleId: number; records: number[][]}[];}
interface Row {
  name: string; skillPresent?: boolean; rolePresent?: boolean; actorPresent?: boolean; effectIds?: number[];
  steps: {action: Action; events: Event[]; state: State}[];
}
const evidence = JSON.parse(readFileSync('recovery/output/skill-effect-message-native.json', 'utf8')) as {states: Row[]};
const packed = (record: Readonly<SkillEffectNotificationRecord<number, number>>): number[] =>
  [record.roleId, record.skillId, record.effectIndex, record.duration, record.effect ?? 0];
let samples = 0;
for (const row of evidence.states) {
  let events: Event[] = [];
  const notifications = new SkillEffectNotifications<number, number, number>({
    skill: skillId => {
      events.push({kind: 'skillLookup', key: skillId});
      return row.skillPresent === false ? undefined : {effects: (row.effectIds ?? [19,23,31])
        .map((effectId, index) => ({effectId, tag: 7 + index, sound: `sound${index}`}))};
    },
    role: roleId => {events.push({kind: 'roleLookup', key: roleId}); return row.rolePresent === false ? undefined : roleId;},
    hasActor: () => row.actorPresent !== false,
    world: (name, position, last) => {events.push({kind: 'worldEffect', name, position, last});},
    attached: (_role, effectId, argument2, effectTag, oneShot) => {
      events.push({kind: 'attachedEffect', effectId, argument2, effectTag, oneShot: Number(oneShot)});
      return 0x12345;
    },
    sound: (_role, reference, selector, offset) => {
      assert.deepEqual(offset, [0,0,-1]);
      events.push({kind: 'soundPosition', selector: selector >>> 0}, {kind: 'sound', reference});
      return 0;
    },
    stopEffect: handle => {events.push({kind: 'effectLookup', handle}, {kind: 'stopEffect'});},
    stopSound: () => {events.push({kind: 'stopSound'});},
    release: record => {events.push({kind: 'free', record: packed(record)});},
    resetRoleEffects: () => {},
  });
  for (const [index, step] of row.steps.entries()) {
    events = [];
    if (step.action.kind === 'play') notifications.play(step.action);
    else if (step.action.kind === 'stop') notifications.stop(step.action);
    else notifications.update(step.action.argument);
    const expected = step.events.filter(event => event.kind !== 'retain').map(event => {
      const {pointer: _pointer, ...value} = event;
      return value;
    });
    assert.deepEqual(events, expected, `${row.name}/${index} callback order`);
    const actual: State = {
      accumulator: notifications.updateAccumulator,
      records: notifications.records.map(packed),
      queues: [...notifications.queues].sort(([left], [right]) => left - right)
        .map(([roleId, records]) => ({roleId, records: records.map(packed)})),
    };
    assert.deepEqual(actual, step.state, `${row.name}/${index} notification state`);
    ++samples;
  }
}
console.log(`PASS: ${evidence.states.length} original notification sequences / ${samples} exact callback and state samples`);
