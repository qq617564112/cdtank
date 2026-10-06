import {EMOTE_COUNT, EMOTE_FIRST_CODEPOINT} from './chat-emote-text';
import type {HomeSourceUi} from '../resources/source-ui-layout';
import {loadChatEmoteSequences} from './chat-emote-animation';
import type {ChatEmoteSequence} from './chat-emote-animation';
import {layoutChatRichText} from './chat-rich-text';
import {parseChatSourceMarkup} from './chat-source-markup';
import {ChatImageCatalog} from './chat-image-catalog';
import {applyChatEmoteColour} from './chat-emote-colour';

/** Received emotions use source sequence providers; edit/picker imagery stays static. */
export class ChatEmotes {
  private images = new Map<number, {asset: string; width: number; height: number}>();
  private sequences?: Map<number,ChatEmoteSequence>;
  private rows = new Map<HTMLElement,string>();
  private animation?: number;
  private previousTime?: number;
  private log?: HTMLElement;
  private sourceLayout = false;
  private canvas?: HTMLCanvasElement;
  private resizeObserver?: ResizeObserver;
  private layoutWidth = 0;
  private imageCatalog?: ChatImageCatalog;
  private loadGeneration = 0;

  setSourceLayout(active: boolean, log: HTMLElement): void {
    if (this.sourceLayout===active && this.log===log) return;
    this.log = log; this.sourceLayout = active;
    this.resizeObserver?.disconnect();
    if (active) {
      this.resizeObserver ??= new ResizeObserver(() => this.relayout());
      this.resizeObserver.observe(log);
    }
    this.layoutWidth = 0;
    for (const [element,text] of this.rows) {
      if (element.isConnected) this.render(element,text);
      else this.rows.delete(element);
    }
  }

  load(ui: HomeSourceUi): void {
    const generation = ++this.loadGeneration;
    this.imageCatalog=new ChatImageCatalog(ui);
    const sets = ui.imagesets.filter(set => set.attributes.Name === 'biaoqingfuhao0');
    const set = sets.find(set => set.path.includes('imagesets_dds/')) ?? sets[0];
    for (let id = 1; id <= EMOTE_COUNT; id++) {
      const name = `data\\ui\\biaoqingfuhao\\${String(id).padStart(3,'0')}.tga`;
      const image = set?.images.find(image => image.Name === name) as
        {asset?: string; Width?: string; Height?: string} | undefined;
      if (image?.asset) this.images.set(id, {asset:image.asset,width:Number(image.Width),height:Number(image.Height)});
    }
    for (const [element,text] of this.rows) {
      if (element.isConnected) this.render(element,text); else this.rows.delete(element);
    }
    void loadChatEmoteSequences().then(sequences=>{
      if (generation !== this.loadGeneration) return;
      this.sequences = sequences;
      for (const [element,text] of this.rows) {
        if (element.isConnected) this.render(element,text); else this.rows.delete(element);
      }
    }).catch(()=>{/* Existing source font imagery remains usable if the sequence resource fails. */});
  }

  render(element: HTMLElement, text: string): void {
    this.rows.set(element,text); element.replaceChildren();
    element.style.height=''; element.classList.toggle('chat-rich-row',this.sourceLayout);
    if (this.sourceLayout && this.log) {
      this.renderRich(element,text);
    } else {
      delete element.dataset.chatRichWidth;
      delete element.dataset.chatRichLineHeight;
      delete element.dataset.chatMarkupStatus;
      element.style.position='';
      for (const glyph of text) {
        const id = glyph.charCodeAt(0)-EMOTE_FIRST_CODEPOINT+1;
        const sequence = this.sequences?.get(id), image = sequence?.definition.frames[0] ?? this.images.get(id);
        if (!image) {element.append(document.createTextNode(glyph)); continue;}
        const img = document.createElement('img'); img.alt=glyph; img.dataset.chatEmote=String(id); img.draggable=false;
        img.src=`/${image.asset}`; img.width=image.width; img.height=image.height;
        if (sequence) this.paint(img,sequence);
        element.append(img);
      }
    }
    if (this.sequences && this.animation === undefined) {
      this.previousTime=undefined;
      this.animation=requestAnimationFrame(time=>this.tick(time));
    }
  }

  clear(): void {
    this.loadGeneration++;
    if (this.animation !== undefined) cancelAnimationFrame(this.animation);
    this.animation=undefined; this.previousTime=undefined; this.rows.clear();
    this.resizeObserver?.disconnect(); this.sourceLayout=false; this.layoutWidth=0;
  }

  remove(element: HTMLElement): void {
    this.rows.delete(element);
    if (!this.rows.size && this.animation !== undefined) {
      cancelAnimationFrame(this.animation);
      this.animation = undefined; this.previousTime = undefined;
    }
  }

  private availableWidth(): number {
    const style=getComputedStyle(this.log!);
    return this.log!.clientWidth-parseFloat(style.paddingLeft||'0')-parseFloat(style.paddingRight||'0');
  }

  private relayout(): void {
    if (!this.sourceLayout || !this.log) return;
    const width=this.availableWidth();
    if (width===this.layoutWidth) return;
    this.layoutWidth=width;
    for (const [element,text] of this.rows) {
      if (element.isConnected) this.render(element,text);
      else this.rows.delete(element);
    }
  }

  private renderRich(element: HTMLElement, text: string): void {
    const context=(this.canvas??=document.createElement('canvas')).getContext('2d');
    if (!context || !this.log) {element.textContent=text;return;}
    const style=getComputedStyle(this.log);
    context.font=`${style.fontSize} ${style.fontFamily}`;
    const measure=(value: string): number => context.measureText(value).width;
    const parsed=parseChatSourceMarkup(text,(set,name)=>Boolean(this.imageCatalog?.image(set,name)));
    element.dataset.chatMarkupStatus=parsed.status;
    const tokens=parsed.items.map(item=>{
      const dimensions=item.image?this.imageCatalog?.image(item.image.set,item.image.name)
        :item.emoteId===undefined?undefined:this.sequences?.get(item.emoteId)?.definition.frames[0]??this.images.get(item.emoteId);
      return {...item,width:dimensions?.width??Math.fround(measure(item.text)),height:dimensions?.height??0};
    });
    const width=this.availableWidth(), height=parseFloat(style.lineHeight)||16;
    this.layoutWidth=width;
    const lines=parsed.status==='parse-error'?[]:layoutChatRichText(tokens,width,measure);
    element.style.position='relative'; element.style.height=`${lines.length*height}px`;
    element.dataset.chatRichWidth=String(width); element.dataset.chatRichLineHeight=String(height);
    lines.forEach((line,index)=>{
      const row=document.createElement('span'); row.dataset.chatRichLine=String(index);
      row.dataset.chatRichAdvance=String(line.width);
      Object.assign(row.style,{position:'absolute',left:'0px',top:`${index*height}px`,width:`${width}px`,height:`${height}px`});
      line.items.forEach((item,itemIndex)=>{
        const piece=document.createElement('span');piece.dataset.chatRichItem=String(itemIndex);
        piece.dataset.chatRichKind=item.image?'image':item.emoteId===undefined?'text':'emote';
        piece.dataset.chatRichText=item.text;piece.dataset.chatRichX=String(item.x);
        piece.dataset.chatRichWidth=String(item.width);piece.dataset.chatRichHeight=String(item.height);
        const colour=item.colour??[1,1,1,1];
        piece.dataset.chatRichColour=colour.join(',');
        piece.style.color=`rgba(${colour[0]*255},${colour[1]*255},${colour[2]*255},${colour[3]})`;
        Object.assign(piece.style,{position:'absolute',left:`${item.x}px`,top:'0px',width:`${item.width}px`,height:`${height}px`,whiteSpace:'pre'});
        if (item.image) {
          const image=this.imageCatalog!.image(item.image.set,item.image.name)!;
          const img=document.createElement('img');img.draggable=false;img.alt='';
          img.dataset.chatSourceImage=item.image.name;img.dataset.chatSourceImageset=item.image.set;
          img.src=`/${image.asset}`;img.width=image.width;img.height=image.height;
          Object.assign(img.style,{position:'absolute',left:'0px',top:'0px',width:`${image.width}px`,height:`${image.height}px`});
          piece.append(img);
        } else if (item.emoteId===undefined) piece.textContent=item.text;
        else {
          const sequence=this.sequences?.get(item.emoteId),image=sequence?.definition.frames[0]??this.images.get(item.emoteId)!;
          const img=document.createElement('img');img.alt=item.text;img.draggable=false;
          img.dataset.chatEmote=String(item.emoteId);img.src=`/${image.asset}`;
          img.width=image.width;img.height=image.height;
          Object.assign(img.style,{position:'absolute',left:'1px',top:'0px',width:`${image.width-1}px`,height:`${image.height}px`});
          applyChatEmoteColour(img,colour,piece);
          if (sequence) this.paint(img,sequence);
          piece.append(img);
        }
        row.append(piece);
      });
      element.append(row);
    });
  }

  private tick(time: number): void {
    this.animation=undefined;
    const delta = this.previousTime === undefined ? 0 : (time-this.previousTime)/1000;
    this.previousTime=time;
    const instances: HTMLImageElement[]=[];
    for (const element of this.rows.keys()) {
      if (!element.isConnected) {this.rows.delete(element);continue;}
      instances.push(...element.querySelectorAll<HTMLImageElement>('img[data-chat-emote]'));
    }
    const active=new Set(instances.map(image=>Number(image.dataset.chatEmote)));
    // A RichEditbox updates each unique provider once, irrespective of glyph count.
    for (const id of active) this.sequences?.get(id)?.advance(delta);
    for (const image of instances) {
      const sequence=this.sequences?.get(Number(image.dataset.chatEmote));
      if (sequence) this.paint(image,sequence);
    }
    if (instances.length) this.animation=requestAnimationFrame(next=>this.tick(next));
    else this.previousTime=undefined;
  }

  private paint(image: HTMLImageElement, sequence: ChatEmoteSequence): void {
    const index=sequence.frame();
    image.dataset.chatEmoteElapsed=String(sequence.elapsed);
    image.dataset.chatEmoteFrame=index===undefined?'none':String(index);
    // A large delta may leave native draw without a frame; preserve inline layout space.
    image.style.visibility=index===undefined?'hidden':'';
    if (index===undefined) return;
    const frame=sequence.definition.frames[index];
    const source=`/${frame.asset}`;
    if (image.getAttribute('src')!==source) image.src=source;
    image.width=frame.width; image.height=frame.height;
  }
}
