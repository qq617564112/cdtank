import type {EffectSoundBackend, EffectSoundStore} from '../render/effects/runtime/effect-sound-node';

interface SoundCatalog {
  sounds: {name: string; asset: string}[];
  defaultSoundVolume: number;
}
interface SoundVoice {source?: AudioBufferSourceNode; ended: boolean;}

/** Predecoded Type4 voices and the original manager's shared sound descriptor. */
export class EffectSound implements EffectSoundBackend<number> {
  readonly shared: EffectSoundStore<number> = {};
  private readonly sounds = new Map<string, AudioBuffer>();
  private readonly voices = new Map<number, SoundVoice>();
  private nextVoice = 0;
  private volume?: number;
  private context?: AudioContext;
  private gain?: GainNode;
  private generation = 0;

  async configure(catalog: SoundCatalog, context: AudioContext): Promise<void> {
    const generation = ++this.generation;
    this.volume ??= catalog.defaultSoundVolume;
    this.context = context;
    if (!this.gain) {
      this.gain = context.createGain();
      this.gain.connect(context.destination);
    }
    this.gain.gain.value = this.volume;
    const decoded = await Promise.all(catalog.sounds.map(async sound => {
      const name = sound.name.toLowerCase();
      const cached = this.sounds.get(name);
      if (cached) return [name, cached] as const;
      const response = await fetch(`/${sound.asset}`);
      if (!response.ok) throw new Error(`特效声音载入失败：${sound.name}`);
      const buffer = await context.decodeAudioData(await response.arrayBuffer());
      return [name, buffer] as const;
    }));
    if (generation !== this.generation || this.context !== context) return;
    for (const [name, buffer] of decoded) this.sounds.set(name, buffer);
  }

  play(reference: string, _parameter: number): number {
    const handle = ++this.nextVoice;
    const buffer = this.sounds.get(reference.toLowerCase());
    const voice: SoundVoice = {ended: true};
    this.voices.set(handle, voice);
    if (buffer && this.context?.state === 'running' && this.gain) {
      const source = this.context.createBufferSource();
      source.buffer = buffer;
      source.loop = false;
      source.connect(this.gain);
      voice.source = source;
      voice.ended = false;
      source.onended = () => this.finish(handle);
      source.start();
    }
    return handle;
  }

  finished(handle: number): boolean {return this.voices.get(handle)?.ended ?? true;}

  private finish(handle: number): void {
    const voice = this.voices.get(handle);
    if (!voice) return;
    voice.ended = true;
    const source = voice.source;
    voice.source = undefined;
    if (!source) return;
    source.onended = null;
    source.disconnect();
  }

  stop(handle: number): void {
    const source = this.voices.get(handle)?.source;
    if (source) {
      source.onended = null;
      source.stop();
    }
    this.finish(handle);
    this.voices.delete(handle);
  }

  update(): void {
    for (const [handle, voice] of this.voices) if (voice.ended) this.voices.delete(handle);
  }

  setVolume(volume: number): void {
    if (!Number.isFinite(volume)) return;
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.gain) this.gain.gain.value = this.volume;
  }

  clear(): void {
    for (const handle of this.voices.keys()) this.stop(handle);
    this.shared.last = undefined;
  }

  dispose(): void {
    this.generation++;
    this.clear();
    this.sounds.clear();
    this.gain?.disconnect();
    this.gain = undefined;
    this.context = undefined;
  }
}
