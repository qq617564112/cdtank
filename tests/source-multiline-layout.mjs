import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {sourceMultilineLayout} from '../apps/web/src/interface/resources/source-multiline-layout.ts';
const native=JSON.parse(await readFile('recovery/output/waiting-room-wrap-native.json','utf8'));
assert.equal(native.status,'PASS');
const measure=text=>Array.from(text).reduce((sum,c)=>sum+(c==='\n'||c==='\r'?0:c==='\t'?4:c.codePointAt(0)<128?6:12),0);
let checked=0;
for(const vector of native.vectors){
 let lines=sourceMultilineLayout(vector.text,vector.width,{advance:measure,extent:vector.inkExtra?text=>measure(text)+(text?vector.inkExtra:0):measure});
 if(lines.length*16>vector.page)lines=sourceMultilineLayout(vector.text,vector.width*.95,{advance:measure,extent:measure});
 if(vector.status==='NO_PROGRESS'){
  assert.deepEqual(lines.map(line=>line.text),['中']);assert.equal(lines[0].extent,0);
 }else assert.deepEqual(lines,vector.rows,vector.name);
 checked++;
}
console.log(`PASS: ${checked} native formatText vectors through production layout (overwide uses explicit clipped Web advance)`);
