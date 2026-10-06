import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SkillEffectFrameScheduler} from '../apps/web/src/match/skills/skill-effect-frame-scheduler';
interface Row {
  start:number;reset:number|null;completion:number;steps:number;sleepMs:number|null;
  state:Omit<ReturnType<typeof snapshot>,'inverseDelta'> & {inverseDelta:number|'Infinity'};
}
function snapshot(subject:SkillEffectFrameScheduler) {return subject.state;}
const native=JSON.parse(readFileSync('recovery/output/skill-effect-frame-scheduler-native.json','utf8')) as {rows:Row[];interval:number;maxSteps:number;boundaries:{elapsed:number;steps:number;sleepMs:number|null}[];conversions:{input:number;result:number}[]};
const scheduler=new SkillEffectFrameScheduler();
assert.equal(scheduler.interval,native.interval);
for(const [index,row] of native.rows.entries()) {
  const decision=scheduler.begin(row.start,row.reset??row.start);
  assert.deepEqual(decision,{steps:row.steps,...(row.sleepMs===null?{}:{sleepMs:row.sleepMs})},`native decision${index}`);
  scheduler.complete(row.completion);
  assert.deepEqual({...snapshot(scheduler),inverseDelta:scheduler.state.inverseDelta===Infinity?'Infinity':scheduler.state.inverseDelta},row.state,`native complete state${index}`);
}
for(const row of native.boundaries) {
  const boundary=new SkillEffectFrameScheduler();
  boundary.begin(0);boundary.complete(0);
  assert.deepEqual(boundary.begin(row.elapsed),{steps:row.steps,...(row.sleepMs===null?{}:{sleepMs:row.sleepMs})});
}
for(const row of native.conversions) assert.equal(Math.trunc(row.input)||0,row.result);
const browser=new SkillEffectFrameScheduler();
assert.equal(browser.poll(0),1);
assert.equal(browser.poll(.005),0);
assert.equal(browser.poll(.032),0);
assert.equal(browser.poll(.033),1);
assert.equal(browser.state.previousCompletion,.033);
assert.equal(browser.poll(.034),0);
assert.equal(browser.poll(.034),0);
assert.equal(browser.poll(.1),1); // Delayed sleep completion returns the already selected step.
assert.equal(browser.poll(.3),3);
assert.equal(browser.state.previousCompletion,.3);
const shared={previousCompletion:0};
const first=new SkillEffectFrameScheduler(shared), second=new SkillEffectFrameScheduler(shared);
first.begin(10);first.complete(10);
second.begin(10.1);second.complete(10.1);
assert.deepEqual(first.begin(10.105),{steps:1,sleepMs:28});
const reset=new SkillEffectFrameScheduler();
assert.equal(reset.poll(10),1);
assert.equal(reset.poll(10.005),0);
reset.reset();
assert.equal(reset.state.previousCompletion,10);
assert.equal(reset.state.initialized,false);
assert.equal(reset.state.sampleCount,0);
assert.equal(reset.poll(20),1);
assert.equal(reset.state.previousCompletion,20);
assert.equal(reset.state.clockStart,20);
console.log(`PASS: ${native.rows.length} exact continuous native frame decisions/states / integer conversion and nonblocking polling`);
