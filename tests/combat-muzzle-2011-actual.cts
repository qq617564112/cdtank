import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
interface MuzzleEffect {root:number; rendered:number[]; nodes:number[]; expired:boolean; liveParent:boolean; vertices:Record<string,number>; textures:Record<string,string>; handle:number; owner:string; matrixChanged:boolean; phase:string;}
interface MuzzleSound {skillId:number; soundId:number; loop:boolean; ended:boolean; context:string; outputPeak:number; duration:number; phase:string;}
interface Snapshot {phase:string;match:{round:number;result:{reason:string;players:{kills:number}[]}};players:{ammoItemId:number}[];}
interface Cleanup {instances:number;meshes:number;voices:number;state:string;}
const run = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const source = JSON.parse(readFileSync('recovery/output/combat-muzzle-2011-source.json', 'utf8'));
assert.equal(run.status, 'PASS');
assert.equal(source.status, 'PASS');
assert(run.sameServerFire.length > 0);
assert(run.sameServerFire.every((event: {skillId: number}) => event.skillId === 2011));
const expected = source.nodes.slice(1).map((node: {index: number}) => node.index).sort((a: number, b: number) => a-b);
const rows = run.observed.map((page: {effects: MuzzleEffect[]; sounds: MuzzleSound[]}, index: number) => {
  const instances = page.effects.filter(effect => effect.root === 3004 && effect.rendered.length > 0 && effect.expired);
  assert(instances.some(effect => effect.rendered.length === 6), 'Each page must record all six source nodes in the same naturally expired instance');
  for (const effect of instances) {
    assert.deepEqual([...effect.nodes].sort((a: number,b: number) => a-b), expected);
    assert(effect.rendered.every(node => expected.includes(node)));
    assert(effect.liveParent);
    assert(Object.values(effect.vertices).every(value => Number(value) > 0));
    assert(Object.values(effect.textures).every(Boolean));
  }
  assert.deepEqual([...new Set(instances.flatMap(effect => effect.rendered))].sort((a:number,b:number)=>a-b), expected);
  const sounds = page.sounds.filter(sound => sound.skillId === 2011);
  assert(sounds.some(sound => sound.soundId === 49 && !sound.loop && sound.ended && sound.context === 'running' && sound.outputPeak > 0));
  for (const sound of sounds) assert(Math.abs(sound.duration - source.sound.duration) < 1e-6);
  assert(page.effects.some(effect => effect.root === 2429 && effect.phase === 'returned' && effect.rendered.length === 5 && effect.expired));
  assert(page.sounds.some(sound => sound.skillId === 2001 && sound.phase === 'returned' && sound.ended && sound.outputPeak > 0));
  return {page:index + 1, completeInstanceCount:instances.filter(effect=>effect.rendered.length===6).length, renderedSourceNodes:expected, muzzleInstances:instances.map(effect => ({handle:effect.handle,owner:effect.owner,nodes:effect.rendered,liveParent:effect.liveParent,matrixChanged:effect.matrixChanged})), sounds};
});
assert(run.cleanup.every((row: Cleanup) => row.instances === 0 && row.meshes === 0 && row.voices === 0 && row.state === 'stopped'));
writeFileSync('recovery/output/combat-muzzle-2011-actual.json', JSON.stringify({status:'PASS',input:process.argv[2],rows,sameServerFire:run.sameServerFire.length,cleanup:run.cleanup},null,2)+'\n');
console.log('PASS: ordinary dual confirmed2011 original053 six submitted nodes/GA08 output, return2001, Leave cleanup');
