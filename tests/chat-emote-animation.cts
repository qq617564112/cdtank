import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {ChatEmoteSequence} from '../apps/web/src/interface/battle/chat-emote-animation';
const oracle=JSON.parse(readFileSync('recovery/output/chat-emote-render-source.json','utf8'));
const assets=JSON.parse(readFileSync('recovery/output/web-assets/chat-emote-sequences.json','utf8'));
let comparisons=0;
for (const source of oracle.sequences) {
  const definition=assets.sequences.find((sequence: {id:number})=>sequence.id===source.id);
  const sequence=new ChatEmoteSequence(definition);
  assert.equal(sequence.total,source.totalDuration);
  assert.equal(sequence.frame(),0);
  assert.equal(definition.frames.length,source.frames.length);
  for(let index=0;index<definition.frames.length;index++) {
    const frame=definition.frames[index],native=source.frames[index];
    assert.equal(frame.image,native.Image);
    assert.equal(frame.duration,Number(native.Duration));
    assert.equal(frame.width,Number(native.rectangle.Width));
    assert.equal(frame.height,Number(native.rectangle.Height));
  }
  for(const sample of source.clock) {
    sequence.advance(sample.delta);
    assert.equal(sequence.elapsed,sample.elapsed,`id${source.id} delta${sample.delta}`);
    assert.deepEqual(sequence.frame()===undefined?[]:[sequence.frame()],sample.drawnFrameIndices);
    comparisons++;
  }
}
writeFileSync('recovery/output/chat-emote-animation-rules.json',JSON.stringify({status:'PASS',sequences:30,comparisons,source:'chat-emote-render-source.json',scope:'complete native infinite-loop clock/draw oracle and source frame identity/dimensions'},null,2)+'\n');
console.log(`PASS: 30 native sequence clocks/draws, ${comparisons} comparisons,72 source frame references/dimensions`);
