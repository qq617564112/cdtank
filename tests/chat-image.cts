import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {ChatImageCatalog} from '../apps/web/src/interface/battle/chat-image-catalog';
import {parseChatSourceMarkup} from '../apps/web/src/interface/battle/chat-source-markup';
import {layoutChatRichText} from '../apps/web/src/interface/battle/chat-rich-text';
import type {HomeSourceUi} from '../apps/web/src/interface/resources/source-ui-layout';

interface SourceResource {set: string; name: string; asset: string; width: number; height: number;}
interface SourceItem {kind: string; text: string | null; width: number; height: number; resource?: SourceResource;}
interface SourceVector {
  name: string; input: string; width: number; failure: unknown;
  lines: {width: number; items: SourceItem[]}[];
  draws: {kind: string; text?: string; resource?: SourceResource; rect: number[]; colourARGB?: string[]}[];
}
const native=JSON.parse(readFileSync('recovery/output/chat-image-source.json','utf8')) as {vectors: SourceVector[]};
const catalog=new ChatImageCatalog(JSON.parse(readFileSync('recovery/output/web-assets/ui.json','utf8')) as HomeSourceUi);
const measure=(text: string): number => Array.from(text).reduce((sum,glyph)=>sum+(glyph==='\n'?0:7),0);
for (const vector of native.vectors) {
  const parsed=parseChatSourceMarkup(vector.input,(set,name)=>Boolean(catalog.image(set,name)));
  if (vector.failure) {
    // Native throws; its caller's unwind/display is unknown. This is an explicit Web fallback.
    assert.equal(parsed.status,'unsupported-source',vector.name);
    assert.equal(parsed.items.map(item=>item.text).join(''),vector.input);
    continue;
  }
  assert.equal(parsed.status,'parsed',vector.name);
  const tokens=parsed.items.map(item=>{
    const resource=item.image?catalog.image(item.image.set,item.image.name):undefined;
    return {...item,width:resource?.width??measure(item.text),height:resource?.height??0};
  });
  const lines=layoutChatRichText(tokens,vector.width,measure);
  assert.deepEqual(lines.map(line=>({width:line.width,items:line.items.map(item=>({
    kind:item.image?'image':'text',text:item.image?null:item.text,width:item.width,height:item.height,
    ...(item.image?{resource:{...item.image,...catalog.image(item.image.set,item.image.name)!}}:{}),
  }))})),vector.lines.map(line=>({width:line.width,items:line.items.map(({kind,text,width,height,resource})=>({
    kind,text,width,height,...(resource?{resource}:{}),
  }))})),vector.name);
  for (const item of tokens.filter(item=>item.image)) assert.deepEqual(item.colour,[1,1,1,1]);
  const draws=lines.flatMap((line,index)=>line.items.map(item=>item.image?{
    kind:'image',resource:{...item.image,...catalog.image(item.image.set,item.image.name)!},
    rect:[20+item.x,10+index*16,20+item.x+item.width,10+index*16+item.height],
    colourARGB:['0xffffffff','0xffffffff','0xffffffff','0xffffffff'],
  }:{kind:'text',text:item.text,rect:[20+item.x,10+index*16,20+vector.width,104]}));
  assert.deepEqual(draws,vector.draws,vector.name);
}
assert.equal(catalog.image('GY0','data\\ui\\gy\\lt1.tga'),undefined,'exact imageset identity');
assert.equal(catalog.image('gy0','data/ui/gy/lt1.tga'),undefined,'exact resource identity');
writeFileSync('recovery/output/chat-image-rules.json',JSON.stringify({status:'PASS',vectors:native.vectors.length,
  scope:'Native successful lookup/layout/draw vectors against production catalog/parser/layout; missing-resource display explicitly Web fallback, native unwind unknown'},null,2)+'\n');
console.log(`PASS: ${native.vectors.length} original image vectors and explicit Web failure fallback`);
