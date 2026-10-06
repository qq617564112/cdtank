import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {EffectActorActionClock} from '../apps/web/src/assets/tanks/effect-actor-clock';
import {effectModelEngineDelta} from '../apps/web/src/render/effects/models/effect-model-animation';
import {roleAmmoActionEffectName, roleAmmoEffectName} from '../apps/web/src/assets/tanks/role-ammo-visual';
interface Action {tankId:number;part:string;action:string;duration:number;events:{time:number;name:string;identifier:number}[];}
const action = (JSON.parse(readFileSync('recovery/output/web-assets/effect-action-events.json','utf8')).actions as Action[])
  .find(action => action.tankId === 1 && action.part === 'M' && action.action === '03')!;
const attack = action.events.find(event => event.name === 'attack1')!;
assert.equal(effectModelEngineDelta(.3),.3);
assert.equal(effectModelEngineDelta(.5),.1);
function sequence(deltas:number[]) {
  const clock=new EffectActorActionClock(action.duration,action.events,true,1,53);
  return deltas.map(delta => {
    const prepared=Math.fround(effectModelEngineDelta(delta));
    const previous=clock.time;
    const messages=clock.advance(prepared);
    return {delta,prepared,previous,time:clock.time,messages};
  });
}
const belowThreshold=sequence([.3,.3]);
assert.equal(belowThreshold[0].time,1441);
assert.deepEqual(belowThreshold[0].messages,[]);
assert.equal(belowThreshold[1].time,2781);
assert.deepEqual(belowThreshold[1].messages,[0x6f766572]);
assert(!belowThreshold.flatMap(frame=>frame.messages).includes(attack.identifier));
const capped=sequence([1,1,1,1,1,1]);
assert.equal(capped.flatMap(frame=>frame.messages).filter(identifier=>identifier===attack.identifier).length,1);
const links=JSON.parse(readFileSync('recovery/output/web-assets/effect-links.json','utf8'));
const actionKey=links.actionKeys.find((key:{name:string})=>key.name==='03').id;
const records=links.files.find((file:{tankCode:string})=>file.tankCode==='001').groups
  .find((group:{key:number})=>group.key===actionKey).actions.find((event:{name:string})=>event.name==='attack1').records;
assert(records.length>0);
assert(records.every((record:{field04String:string})=>roleAmmoActionEffectName('03','attack1',record.field04String,roleAmmoEffectName(4))==='_root\\online\\004'));
writeFileSync('recovery/output/default-muzzle-clock.json',JSON.stringify({status:'PASS',sourceDuration:action.duration,attackTick:attack.time,
  existingNativeParity:'effect-actor-update-native.json and effect-actor-clock.cts',belowThreshold,capped,defaultRecords:records.length,
  conclusion:'Two unchanged0.3-second frames reach native completion before querying attack1. Deltas at least0.5 seconds become0.1 and deliver attack1 on the fourth frame. Both are existing source behavior; no specific browser failure cause is established.'},null,2)+'\n');
console.log('PASS: below0.5 unchanged delta/native completion-before-events, at least0.5 cap0.1 and default004 lookup');
