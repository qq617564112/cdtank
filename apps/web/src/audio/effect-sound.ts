import type {EffectSoundBackend, EffectSoundStore} from '../render/effects/runtime/effect-sound-node';

interface SoundCatalog {
  sounds: {name: string; asset: string}[];
  defaultSoundVolume: number;
}
interface SoundVoice {audio?: HTMLAudioElement; ended: boolean;}

/** Type4 media voices and the original manager's shared sound descriptor. */
export class EffectSound implements EffectSoundBackend<number> {
  readonly shared: EffectSoundStore<number> = {};
  private readonly sounds = new Map<string, string>();
  private readonly voices = new Map<number, SoundVoice>();
  private nextVoice = 0;
  private volume?: number;

  configure(catalog: SoundCatalog): void {
    this.volume ??= catalog.defaultSoundVolume;
    catalog.sounds.forEach(sound => this.sounds.set(sound.name.toLowerCase(), sound.asset));
  }

  play(reference: string, _parameter: number): number {
    const handle = ++this.nextVoice;
    const asset = this.sounds.get(reference.toLowerCase());
    const voice: SoundVoice = {ended: !asset};
    this.voices.set(handle, voice);
    if (asset) {
      const audio = new Audio(`/${asset}`);
      audio.volume = this.volume ?? 1;
      voice.audio = audio;
      audio.addEventListener('ended', () => {voice.ended = true;}, {once: true});
      void audio.play().catch(() => {voice.ended = true;});
    }
    return handle;
  }

  finished(handle: number): boolean {return this.voices.get(handle)?.ended ?? true;}

  stop(handle: number): void {
    const voice = this.voices.get(handle);
    voice?.audio?.pause();
    this.voices.delete(handle);
  }

  update(): void {
    for (const [handle, voice] of this.voices) if (voice.ended) this.voices.delete(handle);
  }

  setVolume(volume: number): void {
    if (!Number.isFinite(volume)) return;
    this.volume = Math.max(0, Math.min(1, volume));
    for (const voice of this.voices.values()) if (voice.audio) voice.audio.volume = this.volume;
  }

  clear(): void {
    for (const handle of this.voices.keys()) this.stop(handle);
    this.shared.last = undefined;
  }
}
