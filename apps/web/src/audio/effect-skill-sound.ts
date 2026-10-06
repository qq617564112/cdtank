import {Camera, Vector3} from '@babylonjs/core';
import type {EffectVec3} from '../render/effects/common/types';

export interface SkillSoundCatalog {
  sounds: {name: string; asset: string}[];
  defaultSoundVolume: number;
  battleKill: {spatial: {referenceDistance: number; maxDistance: number; rolloffFactor: number}};
}
interface Voice {audio: HTMLAudioElement; source: MediaElementAudioSourceNode; panner: PannerNode; gain: GainNode; position: EffectVec3;}

/** Original 485b1b/571d14 role-position sounds and 100/2/1600 attenuation. */
export class EffectSkillSound {
  private context?: AudioContext;
  private master?: GainNode;
  private catalog?: SkillSoundCatalog;
  private readonly voices = new Map<number, Voice>();
  private sequence = 0;
  private volume?: number;
  private readonly resume = (): void => {
    if (this.context?.state === 'suspended') void this.context.resume();
    for (const [handle, voice] of this.voices) {
      if (voice.audio.loop && voice.audio.paused) this.startVoice(handle, voice);
    }
  };
  constructor(private readonly camera: Camera) {}

  configure(catalog: SkillSoundCatalog): void {
    this.catalog = catalog;
    if (this.context) return;
    this.context = new AudioContext();
    this.master = this.context.createGain();
    this.master.gain.value = this.volume ?? catalog.defaultSoundVolume;
    this.master.connect(this.context.destination);
    window.addEventListener('pointerdown', this.resume);
    window.addEventListener('keydown', this.resume);
  }

  play(reference: string, selector: 1 | -1, position: EffectVec3): number {
    const asset = this.catalog?.sounds.find(row => row.name.toLowerCase() === reference.toLowerCase())?.asset;
    if (!asset || !this.context || !this.master) return 0;
    if (selector === 1 && this.context.state !== 'running') return 0;
    const handle = ++this.sequence;
    const audio = new Audio(`/${asset}`);
    audio.loop = selector === -1;
    const source = this.context.createMediaElementSource(audio);
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
    const voice: Voice = {audio, source, panner, gain, position: [...position]};
    this.voices.set(handle, voice);
    audio.addEventListener('ended', () => this.stop(handle), {once: true});
    this.update();
    this.startVoice(handle, voice);
    return handle;
  }

  /** A blocked steady loop keeps its owner until ordinary interaction or explicit stop. */
  private startVoice(handle: number, voice: Voice): void {
    void voice.audio.play().catch(error => {
      if (!voice.audio.loop || error?.name !== 'NotAllowedError') this.stop(handle);
    });
  }

  update(): void {
    if (!this.context || !this.catalog) return;
    const position = this.camera.globalPosition;
    const forward = this.camera.getForwardRay().direction;
    const up = this.camera.getDirection(Vector3.Up());
    const listener = this.context.listener;
    listener.positionX.value = -position.x; listener.positionY.value = position.y; listener.positionZ.value = position.z;
    listener.forwardX.value = -forward.x; listener.forwardY.value = forward.y; listener.forwardZ.value = forward.z;
    listener.upX.value = -up.x; listener.upY.value = up.y; listener.upZ.value = up.z;
    const {referenceDistance, maxDistance, rolloffFactor} = this.catalog.battleKill.spatial;
    for (const voice of this.voices.values()) {
      const distance = Math.hypot(voice.position[0] + position.x, voice.position[1] - position.y, voice.position[2] - position.z);
      const clamped = Math.max(referenceDistance, Math.min(maxDistance, distance));
      voice.gain.gain.value = Math.max(0, Math.min(1, 1 - rolloffFactor * (clamped - referenceDistance) / (maxDistance - referenceDistance)));
    }
  }

  stop(handle: number): void {
    const voice = this.voices.get(handle);
    if (!voice) return;
    voice.audio.pause(); voice.source.disconnect(); voice.panner.disconnect(); voice.gain.disconnect();
    this.voices.delete(handle);
  }
  clear(): void {for (const handle of this.voices.keys()) this.stop(handle);}
  dispose(): void {
    this.clear();
    if (!this.context) return;
    window.removeEventListener('pointerdown', this.resume);
    window.removeEventListener('keydown', this.resume);
    this.master?.disconnect();
    void this.context.close();
    this.context = undefined;
    this.master = undefined;
  }
  setVolume(volume: number): void {this.volume = volume; if (this.master) this.master.gain.value = volume;}
  audioContext(): AudioContext | undefined {return this.context;}
}
