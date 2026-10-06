import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';
const root = 'recovery/output/web-assets/';
const tanks = JSON.parse(readFileSync(root + 'tanks.json', 'utf8'));
const links = JSON.parse(readFileSync(root + 'effect-links.json', 'utf8'));
const library = JSON.parse(readFileSync(root + 'effect-library.json', 'utf8'));
const audio = JSON.parse(readFileSync(root + 'audio.json', 'utf8'));
const tank = tanks.find((tank: {id: number}) => tank.id === 105);
assert.deepEqual(tank.components.map((component: {part: string}) => component.part), ['M', 'U', 'X', 'Y']);
for (const component of tank.components) {
  const action = component.actions.find((action: {fields: {name: string}}) => action.fields.name === '09');
  assert.equal(action.duration, 5601);
  assert(existsSync(root + action.asset));
  if (component.part === 'M') assert.deepEqual(action.events, [{time:160, name:'effect1', identifier:1416378268}]);
}
const group = links.files.find((file: {tankCode: string}) => file.tankCode === '105').groups.find((group: {key: number}) => group.key === 809041920);
const record = group.actions.find((action: {name: string}) => action.name === 'effect1').records[0];
assert.equal(record.field04String, '_root\\online\\006');
assert.equal(record.field148String, 'tag_efcenter');
assert.equal(record.bindingMode, 3);
const nodes: {index: number; type: number; children: number[]; id: number}[] = [];
const visit = (node: typeof nodes[number]): void => {nodes.push(node);node.children.forEach(id => visit(library.nodes.find((node: {id: number}) => node.id === id)));};
visit(library.nodes.find((node: {index: number}) => node.index === 2504));
assert.equal(nodes.filter(node => [1,6,7].includes(node.type)).length, 11);
assert.deepEqual(nodes.filter(node => node.type === 4).map(node => library.soundControls.find((control: {node: number}) => control.node === node.index).reference), ['ww154', 'GA12']);
assert(!audio.sounds.some((sound: {name: string}) => sound.name.toLowerCase() === 'ww154'));
const sound = audio.sounds.find((sound: {name: string}) => sound.name === 'GA12');
assert(readFileSync(sound.source).equals(readFileSync(root + sound.asset)));
console.log('PASS: original10509 four components/effect1, ELK Effect6 live center binding/eleven draws and unchanged GA12 WAV; absent ww154 remains absent');
