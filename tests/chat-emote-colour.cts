import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {parseChatSourceMarkup} from '../apps/web/src/interface/battle/chat-source-markup';

interface NativeEmote {
  kind: string;
  name: string | null;
  floatRGBA?: number[];
}
interface NativeDraw {
  kind: string;
  cornersRGBA?: number[][];
  imageDraw?: {destinationRect: number[]};
  rect: number[];
}
interface NativeVector {
  label: string;
  input: string;
  lines: {items: NativeEmote[]}[];
  draws: NativeDraw[];
}
const source=JSON.parse(readFileSync('recovery/output/chat-emote-colour-source.json','utf8')) as {vectors: NativeVector[]};
for (const vector of source.vectors) {
  const actual=parseChatSourceMarkup(vector.input);
  assert.equal(actual.status,'parsed',vector.label);
  const native=vector.lines.flatMap(line=>line.items).filter(item=>item.kind==='emote');
  const items=actual.items.filter(item=>item.emoteId!==undefined);
  assert.deepEqual(items.map(item=>({id:item.emoteId,rgba:item.colour})),
    native.map(item=>({id:Number(item.name),rgba:item.floatRGBA})),vector.label);
  const draws=vector.draws.filter(draw=>draw.kind==='emote');
  assert.equal(draws.length,items.length);
  draws.forEach((draw,index)=>{
    assert.deepEqual(draw.cornersRGBA,[items[index].colour,items[index].colour,items[index].colour,items[index].colour]);
    assert.deepEqual(draw.imageDraw?.destinationRect,draw.rect,'native sequence/frame consumers preserve geometry');
  });
}
writeFileSync('recovery/output/chat-emote-colour-rules.json',JSON.stringify({status:'PASS',vectors:source.vectors.length,
  scope:'Production parser colours match original item and four-corner sequence/frame image-draw parameters; Web raster pixels verified separately'},null,2)+'\n');
console.log(`PASS: ${source.vectors.length} native emote item and sequence/frame colour vectors`);
