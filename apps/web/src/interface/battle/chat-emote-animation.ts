export interface ChatEmoteFrame {
  duration: number;
  asset: string;
  width: number;
  height: number;
}
export interface ChatEmoteSequenceDefinition {id: number; name: string; frames: ChatEmoteFrame[];}

/** Native SequenceImage infinite-loop update and draw selection, without modulo. */
export class ChatEmoteSequence {
  elapsed = 0;
  readonly total: number;
  constructor(readonly definition: ChatEmoteSequenceDefinition) {
    this.total = definition.frames.reduce((sum,frame)=>Math.fround(sum+Math.fround(frame.duration)),0);
  }
  advance(delta: number): void {
    this.elapsed = Math.fround(this.elapsed+Math.fround(delta));
    if (this.elapsed > this.total) this.elapsed = Math.fround(this.elapsed-this.total);
  }
  frame(): number | undefined {
    let end = 0;
    for (let index=0;index<this.definition.frames.length;index++) {
      end = Math.fround(end+Math.fround(this.definition.frames[index].duration));
      if (end >= this.elapsed) return index;
    }
    return undefined;
  }
}

let library: Promise<Map<number,ChatEmoteSequence>> | undefined;
/** Manager providers persist by name across message reformatting and chat owners. */
export function loadChatEmoteSequences(): Promise<Map<number,ChatEmoteSequence>> {
  return library ??= fetch('/chat-emote-sequences.json').then(async response=>{
    if (!response.ok) throw new Error('原表情动画目录缺失');
    const data = await response.json() as {sequences: ChatEmoteSequenceDefinition[]};
    if (!Array.isArray(data.sequences) || data.sequences.length !== 30) throw new Error('原表情动画目录不完整');
    const sequences = new Map<number,ChatEmoteSequence>();
    for (const sequence of data.sequences) {
      if (!Number.isInteger(sequence.id) || sequence.id<1 || sequence.id>30 || sequences.has(sequence.id)
          || sequence.name !== String(sequence.id).padStart(3,'0') || !Array.isArray(sequence.frames)
          || !sequence.frames.length || sequence.frames.some(frame=>!Number.isFinite(frame.duration)
            || frame.duration<=0 || typeof frame.asset!=='string' || !frame.asset.startsWith('ui/regions/')
            || !Number.isInteger(frame.width) || frame.width<=0 || !Number.isInteger(frame.height) || frame.height<=0)) {
        throw new Error('原表情动画帧无效');
      }
      sequences.set(sequence.id,new ChatEmoteSequence(sequence));
    }
    return sequences;
  }).catch(error=>{library=undefined;throw error;});
}
