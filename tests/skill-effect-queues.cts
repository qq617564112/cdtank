import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SkillEffectNotifications} from '../apps/web/src/match/skills/skill-effect-notifications';
interface Event {kind: string; [key: string]: unknown;}
interface Row {action: string; events: Event[]; handles: number[]; durations: number[]; count: number;}
const native = JSON.parse(readFileSync('recovery/output/skill-effect-queue-native.json', 'utf8')) as {
  queues: Row[]; cleanup: Event[]; allCleanup: Event[]; scheduler: {delta: number; remaining: number; expired: number; events: Event[]}[];
};
let events: Event[] = [];
let handles = 100;
const make = () => new SkillEffectNotifications<number, number, number>({
  skill: id => {events.push({kind:'skill',id}); return {effects:[19,23,31].map((effectId,index)=>({effectId,tag:7+index,sound:`sound${index}`}))};},
  role: id => id,
  hasActor: () => true,
  world: () => {},
  attached: (_role,...args) => {++handles; events.push({kind:'attach',args:[...args.slice(0,3),Number(args[3])],handle:handles}); return handles;},
  sound: (_role,_reference,selector,offset) => {events.push({kind:'position',selector:selector>>>0,offset},{kind:'sound'}); return handles;},
  stopEffect: handle => {events.push({kind:'lookupEffect',handle:handle??0},{kind:'stopEffect'});},
  stopSound: token => {events.push({kind:'stopSound',token:token??0});},
  release: () => {events.push({kind:'free'});},
  resetRoleEffects: id => {events.push({kind:'roleReset',id});},
});
const subject = make();
for (let index=0;index<3;++index) subject.play({skillId:13501+index,effectIndex:index,duration:99,roleId:47,xBits:0,zBits:0});
for (const [index,row] of native.queues.slice(0,5).entries()) {
  events=[];
  if (index===0) subject.revive(47);
  else subject.alternate(47,[13501,13502,13503,13501][index-1]);
  assert.deepEqual(events,row.events.filter(event=>!['schedule','cancel'].includes(event.kind)),`${index}/callbacks`);
  const queue=subject.queues.get(47)!;
  assert.deepEqual(queue.map(record=>record.effect??0),row.handles);
  assert.deepEqual(queue.map(record=>record.duration),row.durations);
  assert.equal(queue.length,row.count);
  const scheduled=row.events.find(event=>event.kind==='schedule')!;
  assert.deepEqual(subject.queueTimers.get(47),{skillId:scheduled.skill,remaining:scheduled.delay});
}
subject.revive(47);
events=[]; subject.clearRole(47);
const expectedCleanup=native.cleanup.filter(event=>!['cancel','deleteVector','eraseRole'].includes(event.kind));
expectedCleanup.pop(); // Native vector allocation release has no production record counterpart.
assert.deepEqual(events,expectedCleanup.map(({pointer:_pointer,...event})=>event));
assert.equal(subject.queues.size,0); assert.equal(subject.queueTimers.size,0);
handles=105;
const single=make(); single.play({skillId:13501,effectIndex:0,duration:99,roleId:47,xBits:0,zBits:0});
events=[]; single.revive(47);
assert.deepEqual(events,native.queues[5].events);
assert.equal(single.queueTimers.size,0);
events=[]; single.revive(48); assert.deepEqual(events,[]);
handles=100;
const timer=make();
for (let index=0;index<3;++index) timer.play({skillId:13501+index,effectIndex:index,duration:99,roleId:47,xBits:0,zBits:0});
timer.revive(47);
for (const step of native.scheduler) {
  events=[]; timer.advanceTimers(step.delta);
  if (!step.expired) {assert.deepEqual(events,[]); assert.equal(timer.queueTimers.get(47)!.remaining,step.remaining);}
  else {assert.equal(timer.queueTimers.get(47)!.skillId,13502); assert.equal(timer.queueTimers.get(47)!.remaining,5);}
}
events=[]; timer.clear(); assert.equal(timer.queues.size,0); assert.equal(timer.queueTimers.size,0);
assert.equal(events.filter(event=>event.kind==='free').length,3);
events=[]; timer.advanceTimers(100); assert.deepEqual(events,[]);

handles=100;
const all=make();
for (let index=0;index<3;++index) all.play({skillId:13501+index,effectIndex:index,duration:99,roleId:47,xBits:0,zBits:0});
all.revive(47);
for (const skill of [13501,13502,13503,13501]) all.alternate(47,skill);
all.revive(47); events=[]; all.clear();
const expectedAll=native.allCleanup.filter(event=>!['cancel','deleteVector','eraseRole'].includes(event.kind));
expectedAll.pop();
assert.deepEqual(events,expectedAll.map(({pointer:_pointer,...event})=>event));
assert.equal(all.queueTimers.size,0); assert.equal(all.queues.size,0);
console.log('PASS: original queue activation, cyclic selection, one-shot timer and role/all cleanup');
