import {EMOTE_COUNT, EMOTE_FIRST_CODEPOINT} from './chat-emote-text';

export type ChatColour = readonly [number, number, number, number];
export interface ChatImageReference {set: string; name: string;}
export interface ChatMarkupItem {text: string; emoteId?: number; image?: ChatImageReference; colour: ChatColour;}
export interface ChatMarkupResult {status: 'parsed' | 'parse-error' | 'unsupported-source'; items: ChatMarkupItem[];}
interface MarkupNode {name?: string; attributes: Record<string,string>; text?: string; children: MarkupNode[];}

/** Original decoded-glyph expansion; plain received markup is deliberately unescaped. */
export function chatSourceMarkup(text: string): string {
  return Array.from(text,glyph=>{
    const id=glyph.charCodeAt(0)-EMOTE_FIRST_CODEPOINT+1;
    return id>=1 && id<=EMOTE_COUNT
      ? `<emote name=${String(id).padStart(3,'0')} red=255 green=255 blue=255 alpha=255/>` : glyph;
  }).join('');
}

function entities(text: string): string {
  return text.replace(/&(?:#x([0-9a-f]+);|#([0-9]+);|(amp|lt|gt|quot|apos);)?/gi,
    (_,hex: string,decimal: string,named: string)=>{
      if (hex || decimal) {
        const value=parseInt(hex||decimal,hex?16:10);
        // Native legacy encoding produces a byte before CEGUI conversion.
        return String.fromCharCode(value&255);
      }
      return ({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"} as Record<string,string>)[named]??'';
    });
}

/** Embedded TinyXML syntax consumed as data, never inserted as HTML. */
export function parseChatSourceMarkup(text: string,
  resolveImage?: (set: string,name: string) => boolean): ChatMarkupResult {
  const markup=`<colour red=255 green=255 blue=255 alpha=255>${chatSourceMarkup(text)}</colour>`;
  const document: MarkupNode={attributes:{},children:[]};
  const stack=[document];
  let position=0;
  const error=(): ChatMarkupResult=>({status:'parse-error',items:[]});
  while (position<markup.length) {
    if (markup[position]!=='<') {
      const end=markup.indexOf('<',position);
      const value=entities(markup.slice(position,end<0?markup.length:end));
      if (value) stack[stack.length-1].children.push({text:value,attributes:{},children:[]});
      position=end<0?markup.length:end;continue;
    }
    if (markup.startsWith('<!--',position)) {
      const end=markup.indexOf('-->',position+4);if (end<0) return error();
      position=end+3;continue;
    }
    const close=/^<\/([A-Za-z_:][\w:.-]*)\s*>/.exec(markup.slice(position));
    if (close) {
      if (stack.length===1 || stack[stack.length-1].name!==close[1]) return error();
      stack.pop();position+=close[0].length;continue;
    }
    const open=/^<([A-Za-z_:][\w:.-]*)/.exec(markup.slice(position));
    if (!open) return error();
    const node: MarkupNode={name:open[1],attributes:{},children:[]};
    position+=open[0].length;
    let selfClosing=false;
    while (position<markup.length) {
      const whitespace=/^\s*/.exec(markup.slice(position))![0];position+=whitespace.length;
      if (markup.startsWith('/>',position)) {selfClosing=true;position+=2;break;}
      if (markup[position]==='>') {position++;break;}
      const attribute=/^([A-Za-z_:][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s/>]+))/.exec(markup.slice(position));
      if (!attribute || node.attributes[attribute[1]]!==undefined) return error();
      node.attributes[attribute[1]]=entities(attribute[2]??attribute[3]??attribute[4]);
      position+=attribute[0].length;
    }
    stack[stack.length-1].children.push(node);
    if (!selfClosing) stack.push(node);
  }
  if (stack.length!==1) return error();
  const items: ChatMarkupItem[]=[];
  let unsupported=false;
  let colour: ChatColour=[1,1,1,1], previous: ChatColour=colour;
  const rgba=(attributes: Record<string,string>): ChatColour=>['red','green','blue','alpha'].map(key=>Math.fround((Number(attributes[key])||0)/255)) as unknown as ChatColour;
  const visit=(node: MarkupNode): void=>{
    if (node.text!==undefined) {items.push({text:node.text,colour});return;}
    if (node.name==='colour') {previous=colour;colour=rgba(node.attributes);}
    if (node.name==='emote') {
      const id=Number(node.attributes.name);
      if (Number.isInteger(id) && id>=1 && id<=EMOTE_COUNT) {
        items.push({text:String.fromCharCode(EMOTE_FIRST_CODEPOINT+id-1),emoteId:id,colour:rgba(node.attributes)});
      } else unsupported=true;
    }
    if (node.name==='image') {
      const set=node.attributes.set??'',name=node.attributes.name??'';
      if (resolveImage?.(set,name)) items.push({text:'',image:{set,name},colour:[1,1,1,1]});
      else unsupported=true;
    }
    for (const child of node.children) visit(child);
    // Native colour restoration uses one previous slot, not a nested stack.
    if (node.name==='colour') colour=previous;
  };
  for (const node of document.children) visit(node);
  return unsupported ? {status:'unsupported-source',items:[{text,colour:[1,1,1,1]}]} : {status:'parsed',items};
}
