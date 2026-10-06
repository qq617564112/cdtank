import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {parseChatSourceMarkup} from '../apps/web/src/interface/battle/chat-source-markup';
interface NativeItem {kind: string; text: string | null; name: string | null; colour: number[];}
interface NativeVector {input: string; events: {kind: string}[]; lines: {items: NativeItem[]}[];}
const source=JSON.parse(readFileSync('recovery/output/chat-xml-source.json','utf8')) as {vectors: NativeVector[]};
for (const vector of source.vectors) {
  const result=parseChatSourceMarkup(vector.input);
  assert.equal(result.status,vector.events.some(event=>event.kind==='parse-error')?'parse-error':'parsed',vector.input);
  // Native text ARGB provider stores a/r/g/b; emote colour provider stores r/g/b/a.
  const expected=vector.lines.flatMap(line=>line.items).map(item=>({
    text:item.kind==='text'?item.text:String.fromCharCode(0x2580+Number(item.name)),
    ...(item.kind==='emote'?{emoteId:Number(item.name)}:{}),
    colour:item.kind==='text'?[item.colour[1],item.colour[2],item.colour[3],item.colour[0]]:item.colour,
  }));
  // Newline is split by the later layout consumer, not the XML text traversal.
  const actual=result.items.flatMap(item=>item.emoteId!==undefined?[item]:item.text.split(/(?<=\n)/).filter(Boolean).map(text=>({...item,text})));
  assert.deepEqual(actual,expected,vector.input);
}
writeFileSync('recovery/output/chat-source-markup-rules.json',JSON.stringify({status:'PASS',vectors:source.vectors.length,scope:'Original wrapper/parser/traversal token and colour outputs; legacy OS encoding and image/unknown sequence consumers remain boundaries'},null,2)+'\n');
console.log(`PASS: ${source.vectors.length} original XML received-message vectors`);
