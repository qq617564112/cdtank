import {EMOTE_COUNT, EMOTE_FIRST_CODEPOINT} from './chat-emote-text';
import type {ChatColour, ChatImageReference} from './chat-source-markup';

export interface ChatRichToken {
  text: string;
  width: number;
  height: number;
  emoteId?: number;
  colour?: ChatColour;
  image?: ChatImageReference;
}

/** TSRPC supplies decoded glyphs; ordinary text stays literal, never HTML/XML. */
export function chatRichTokens(text: string,
  image: (id: number) => {width: number; height: number} | undefined,
  measure: (text: string) => number): ChatRichToken[] {
  const tokens: ChatRichToken[] = [];
  let plain = '';
  const flush = (): void => {
    if (!plain) return;
    tokens.push({text:plain, width:Math.fround(measure(plain)), height:0});
    plain = '';
  };
  for (const glyph of text) {
    const id = glyph.charCodeAt(0)-EMOTE_FIRST_CODEPOINT+1;
    const dimensions = id >= 1 && id <= EMOTE_COUNT ? image(id) : undefined;
    if (dimensions) {
      flush();
      tokens.push({text:glyph, width:dimensions.width, height:dimensions.height, emoteId:id});
    } else {
      plain += glyph;
    }
  }
  flush(); return tokens;
}

export interface ChatRichItem extends ChatRichToken {x: number;}
export interface ChatRichLine {width: number; items: ChatRichItem[];}

/** Native RichEdit splits text at a font pixel boundary, without word wrapping. */
export function layoutChatRichText(tokens: readonly ChatRichToken[], width: number,
  measure: (text: string) => number): ChatRichLine[] {
  width = Math.fround(width);
  const lines: ChatRichLine[] = [];
  let line: ChatRichLine = {width:0, items:[]};
  const commit = (): void => {lines.push(line); line = {width:0, items:[]};};
  const append = (token: ChatRichToken): void => {
    line.items.push({...token,x:line.width});
    line.width = Math.fround(line.width+token.width);
  };
  for (const token of tokens) {
    if (token.emoteId !== undefined || token.image !== undefined) {
      if (Math.fround(line.width+token.width) > width) commit();
      append(token); continue;
    }
    const paragraphs = token.text.split('\n');
    for (let index=0;index<paragraphs.length;index++) {
      let remaining = paragraphs[index];
      while (Math.fround(line.width+Math.fround(measure(remaining))) > width) {
        let count = 0;
        const characters = Array.from(remaining);
        while (count<characters.length && Math.fround(measure(characters.slice(0,count+1).join(''))) <= Math.fround(width-line.width)) count++;
        // Native zero pixel-boundary fallback consumes the entire remaining
        // text, even when it exceeds the available width.
        if (count===0) count=characters.length;
        const prefix = characters.slice(0,count).join('');
        append({...token,text:prefix,width:Math.fround(measure(prefix)),height:0});
        remaining = characters.slice(count).join(''); commit();
      }
      const text = remaining+(index<paragraphs.length-1 ? '\n' : '');
      if (text) append({...token,text,width:Math.fround(measure(remaining)),height:0});
      if (index<paragraphs.length-1) commit();
    }
  }
  lines.push(line);
  return lines;
}
