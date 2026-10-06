import assert from 'node:assert/strict';
import {emoteGlyph, normalizeEmoteInput} from '../apps/web/src/interface/battle/chat-emote-text';
for (let id = 1; id <= 30; id++) {
  assert.equal(emoteGlyph(id).charCodeAt(0),0x2580+id);
  const token = `/${String(id).padStart(2,'0')}`;
  assert.equal(normalizeEmoteInput(`中文${token}结束${token}`),`中文${emoteGlyph(id)}结束${emoteGlyph(id)}`);
  assert.equal(normalizeEmoteInput(`${token}0`),`${emoteGlyph(id)}0`);
}
for (const id of [0,31,-1,1.5,NaN]) assert.throws(()=>emoteGlyph(id));
assert.equal(normalizeEmoteInput('/00 /31 /39 /aa <emote name=001/>'),'/00 /31 /39 /aa <emote name=001/>');
assert.equal(normalizeEmoteInput('/01/02/30'),emoteGlyph(1)+emoteGlyph(2)+emoteGlyph(30));
assert.equal(normalizeEmoteInput('中'.repeat(69)+'/01').length,70);
console.log('PASS: 30 source glyphs, complete-text aliases, adjacency, unknown literal text and logical lengths');
