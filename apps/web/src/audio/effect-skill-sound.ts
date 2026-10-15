import {Camera} from '@babylonjs/core';
import {setCameraSpatialListener} from './spatial-listener';
import type {EffectVec3} from '../render/effects/common/types';
import {loadAudioBuffer} from './audio-resources';
import {listenForAudioInteraction} from './audio-interaction';

export interface SkillSoundCatalog {
  sounds: {name: string; asset: string}[];
  defaultSoundVolume: number;
  battleKill: {spatial: {referenceDistance: number; maxDistance: number; rolloffFactor: number}};
}
interface Voice {source: AudioBufferSourceNode; panner: PannerNode; gain: GainNode; position: EffectVec3; activeHandles?: Set<number>;}

/** Original 485b1b/571d14 role-position sounds and 100/2/1600 attenuation. */
export class EffectSkillSound {
  private context?: AudioContext;
  private master?: GainNode;
  private catalog?: SkillSoundCatalog;
  private readonly sounds = new Map<string, AudioBuffer>();
  private readonly voices = new Map<number, Voice>();
  private sequence = 0;
  private generation = 0;
  private volume?: number;
  private attenuationX = NaN;
  private attenuationY = NaN;
  private attenuationZ = NaN;
  private referenceDistance = NaN;
  private maxDistance = NaN;
  private rolloffFactor = NaN;
  private removeInteraction?: () => void;
  private readonly resume = (): void => {
    if (this.context?.state === 'suspended') {
      void this.context.resume().catch(() => {});
    }
  };
  constructor(private readonly camera: Camera) {
    this.context = new AudioContext();
    this.master = this.context.createGain();
    this.master.connect(this.context.destination);
    this.removeInteraction = listenForAudioInteraction(this.resume);
  }

  async configure(catalog: SkillSoundCatalog): Promise<void> {
    const generation = ++this.generation;
    this.catalog = catalog;
    this.master!.gain.value = this.volume ?? catalog.defaultSoundVolume;
    const context = this.context!;
    const decoded = await Promise.all(catalog.sounds.map(async sound => [sound.name.toLowerCase(),
      await loadAudioBuffer(`/${sound.asset}`, context)] as const));
    if (this.context !== context || this.generation !== generation) return;
    for (const [name, buffer] of decoded) this.sounds.set(name, buffer);
    this.resume();
  }

  /** Register successful voices in the supplied set until stop or natural completion. */
  play(reference: string, selector: 1 | -1, position: EffectVec3, activeHandles?: Set<number>): number {
    const buffer = this.sounds.get(reference.toLowerCase());
    if (!buffer || !this.context || !this.master) return 0;
    if (selector === 1 && this.context.state !== 'running') return 0;
    const handle = ++this.sequence;
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.loop = selector === -1;
    const panner = this.context.createPanner();
    const gain = this.context.createGain();
    const spatial = this.catalog!.battleKill.spatial;
    panner.panningModel = 'equalpower';
    panner.distanceModel = 'linear';
    panner.refDistance = spatial.referenceDistance;
    panner.maxDistance = spatial.maxDistance;
    panner.rolloffFactor = 0;
    [panner.positionX.value, panner.positionY.value, panner.positionZ.value] = position;
    panner.orientationX.value = 0; panner.orientationY.value = 0; panner.orientationZ.value = -1;
    source.connect(panner); panner.connect(gain); gain.connect(this.master);
    const voice: Voice = {source, panner, gain, position: [...position], activeHandles};
    this.voices.set(handle, voice);
    activeHandles?.add(handle);
    source.onended = () => this.stop(handle);
    this.updateVoices(voice);
    source.start();
    return handle;
  }

  update(): void {this.updateVoices();}

  private updateVoices(addedVoice?: Voice): void {
    if (!this.context || !this.catalog) return;
    const position = this.camera.globalPosition;
    setCameraSpatialListener(this.context.listener, this.camera);
    const {referenceDistance, maxDistance, rolloffFactor} = this.catalog.battleKill.spatial;
    if (position.x === this.attenuationX && position.y === this.attenuationY && position.z === this.attenuationZ &&
        referenceDistance === this.referenceDistance && maxDistance === this.maxDistance && rolloffFactor === this.rolloffFactor) {
      if (addedVoice) this.attenuate(addedVoice);
      return;
    }
    this.attenuationX = position.x; this.attenuationY = position.y; this.attenuationZ = position.z;
    this.referenceDistance = referenceDistance; this.maxDistance = maxDistance; this.rolloffFactor = rolloffFactor;
    for (const voice of this.voices.values()) this.attenuate(voice);
  }

  private attenuate(voice: Voice): void {
    const {referenceDistance, maxDistance, rolloffFactor} = this;
    const distance = Math.hypot(voice.position[0] + this.attenuationX,
      voice.position[1] - this.attenuationY, voice.position[2] - this.attenuationZ);
    const clamped = Math.max(referenceDistance, Math.min(maxDistance, distance));
    voice.gain.gain.value = Math.max(0, Math.min(1, 1 - rolloffFactor * (clamped - referenceDistance) / (maxDistance - referenceDistance)));
  }

  stop(handle: number): void {
    const voice = this.voices.get(handle);
    if (!voice) return;
    this.voices.delete(handle);
    voice.activeHandles?.delete(handle);
    voice.source.onended = null;
    voice.source.stop();
    voice.source.disconnect(); voice.panner.disconnect(); voice.gain.disconnect();
  }
  clear(): void {for (const handle of this.voices.keys()) this.stop(handle);}
  releaseResources(): void {this.generation++; this.clear(); this.sounds.clear(); this.catalog = undefined;}
  dispose(): void {
    this.generation++;
    this.clear();
    this.sounds.clear();
    if (!this.context) return;
    this.removeInteraction?.();
    this.removeInteraction = undefined;
    this.master?.disconnect();
    void this.context.close();
    this.context = undefined;
    this.master = undefined;
  }
  setVolume(volume: number): void {this.volume = volume; if (this.master) this.master.gain.value = volume;}
  audioContext(): AudioContext | undefined {return this.context;}
}
