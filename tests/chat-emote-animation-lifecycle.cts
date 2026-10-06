import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {ChatEmotes} from '../apps/web/src/interface/battle/chat-emotes';
import {ChatEmoteSequence} from '../apps/web/src/interface/battle/chat-emote-animation';
let next=0;
const callbacks=new Map<number,FrameRequestCallback>();
const originals=new Map<string,PropertyDescriptor|undefined>();
class ImageFixture {
  dataset: Record<string,string> = {chatEmote:'1'};
  style={visibility:''};
  attributes=new Map<string,string>();
  width=0; height=0;
  set src(value:string) {this.attributes.set('src',value);}
  getAttribute(name:string) {return this.attributes.get(name)??null;}
}
const image1=new ImageFixture(),image2=new ImageFixture(),image3=new ImageFixture();
const first={isConnected:true,querySelectorAll:()=>[image1,image2]};
const second={isConnected:true,querySelectorAll:()=>[image3]};
for (const [name,value] of Object.entries({
  requestAnimationFrame:(callback:FrameRequestCallback)=>{const id=++next;callbacks.set(id,callback);return id;},
  cancelAnimationFrame:(id:number)=>{callbacks.delete(id);},
})) {
  originals.set(name,Object.getOwnPropertyDescriptor(globalThis,name));
  Object.defineProperty(globalThis,name,{configurable:true,value});
}
interface RuntimeFixture {
  sequences: Map<number,ChatEmoteSequence>;
  rows: Map<HTMLElement,string>;
  tick(time:number):void;
}
try {
  const definition=JSON.parse(readFileSync('recovery/output/web-assets/chat-emote-sequences.json','utf8')).sequences[0];
  const provider=new ChatEmoteSequence(definition);
  const production=new ChatEmotes();
  const fixture=production as unknown as RuntimeFixture;
  fixture.sequences=new Map([[1,provider]]);
  fixture.rows.set(first as unknown as HTMLElement,'first');
  fixture.tick(0);
  const frame=(time:number)=>{const [id,callback]=callbacks.entries().next().value!;callbacks.delete(id);callback(time);};
  frame(100);assert.equal(provider.elapsed,Math.fround(.1));
  assert.equal(image1.dataset.chatEmoteElapsed,image2.dataset.chatEmoteElapsed);
  fixture.rows.set(second as unknown as HTMLElement,'second');
  frame(200);assert.equal(provider.elapsed,Math.fround(.2),'new message neither resets nor double advances shared provider');
  assert.equal(image1.dataset.chatEmoteFrame,'0','exact native boundary keeps previous frame');
  assert.equal(image1.dataset.chatEmoteElapsed,image3.dataset.chatEmoteElapsed);
  first.isConnected=false;frame(201);assert.equal(fixture.rows.size,1,'clipped row no longer retained');
  assert.equal(image3.dataset.chatEmoteFrame,'1');
  const elapsed=provider.elapsed;production.clear();
  assert.equal(callbacks.size,0);assert.equal(fixture.rows.size,0);assert.equal(provider.elapsed,elapsed,'owner clear preserves manager time');
  fixture.rows.set(second as unknown as HTMLElement,'reentry');fixture.tick(4000);
  assert.equal(provider.elapsed,elapsed,'new owner scheduling begins without charging hidden elapsed time');
  second.isConnected=false;frame(4010);assert.equal(callbacks.size,0);assert.equal(fixture.rows.size,0);
  production.clear();
  writeFileSync('recovery/output/chat-emote-animation-lifecycle.json',JSON.stringify({status:'PASS',scope:'production tick with DOM/RAF boundaries: duplicate glyph/new row sharing, clipped row cleanup, owner clear cancellation and provider preservation; Web hidden-time adaptation'},null,2)+'\n');
  console.log('PASS: production provider deduplication/new rows, clipping/clear cancellation and retained phase');
} finally {
  for(const [name,descriptor] of originals) {
    if(descriptor)Object.defineProperty(globalThis,name,descriptor);else Reflect.deleteProperty(globalThis,name);
  }
}
