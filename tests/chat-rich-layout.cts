import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {layoutChatRichText} from '../apps/web/src/interface/battle/chat-rich-text';
import type {ChatRichToken} from '../apps/web/src/interface/battle/chat-rich-text';

interface NativeItem {kind: string; text?: string; name?: string; width: number; height: number;}
interface NativeVector {
  width: number;
  chunks: [string,string][];
  lines: {width: number; items: NativeItem[]}[];
  draws: {kind: string; text?: string; name?: string; rect: number[]}[];
}
const native = JSON.parse(readFileSync('recovery/output/chat-rich-layout-source.json','utf8')) as {vectors: NativeVector[]};
const sequences = JSON.parse(readFileSync('recovery/output/web-assets/chat-emote-sequences.json','utf8'));
const measure = (text: string): number => Array.from(text).reduce((sum,glyph) => sum+(glyph==='\n' ? 0 : glyph.charCodeAt(0)>127 ? 14 : 7),0);
for (const vector of native.vectors) {
  const tokens: ChatRichToken[] = vector.chunks.map(([kind,text]) => {
    if (kind==='text') return {text,width:measure(text),height:0};
    const id=Number(text), frame=sequences.sequences.find((sequence: {id: number}) => sequence.id===id).frames[0];
    return {text:String.fromCharCode(0x2580+id),width:frame.width,height:frame.height,emoteId:id};
  });
  const actual=layoutChatRichText(tokens,vector.width,measure);
  assert.deepEqual(actual.map(line=>({width:line.width,items:line.items.map(item=>({
    kind:item.emoteId===undefined?'text':'emote', text:item.emoteId===undefined?item.text:null,
    name:item.emoteId===undefined?null:String(item.emoteId).padStart(3,'0'),width:item.width,height:item.height,
  }))})),vector.lines.map(line=>({width:line.width,items:line.items.map(({kind,text,name,width,height})=>({kind,text,name,width,height}))})));
  const draws=actual.flatMap((line,index)=>line.items.map(item=>item.emoteId===undefined
    ? {kind:'text',text:item.text,rect:[20+item.x,10+index*16,20+vector.width,104]}
    : {kind:'emote',name:String(item.emoteId).padStart(3,'0'),rect:[21+item.x,10+index*16,20+item.x+item.width,10+index*16+item.height]}));
  assert.deepEqual(draws,vector.draws,'native renderer origins, fixed line spacing and source-width-minus-one image destination');
}
writeFileSync('recovery/output/chat-rich-layout-rules.json',JSON.stringify({status:'PASS',vectors:native.vectors.length,scope:'Original mixed text/emote line items with explicit font provider metrics; font measurement and XML parser remain boundary'},null,2)+'\n');
console.log(`PASS: ${native.vectors.length} native mixed text/emote layout vectors`);
