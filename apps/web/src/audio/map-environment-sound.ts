import {Camera, Vector3} from '@babylonjs/core';
import type {EffectVec3} from '../render/effects/common/types';
import type {SkillSoundCatalog} from './effect-skill-sound';

interface EnvironmentSoundPlacement {
  id: string;
  name: string;
  position: EffectVec3;
  enabled: boolean;
  gain: number;
  intervalMs: number;
  randomGate: boolean;
  selector: -1;
  spatial: boolean;
  direction: EffectVec3;
}
interface EnvironmentSoundMap {
  mapId: number;
  sounds: EnvironmentSoundPlacement[];
  spatial: {referenceDistance: number; maxDistance: number; rolloffFactor: number};
}
interface EnvironmentVoice {
  placement: EnvironmentSoundPlacement;
  audio: HTMLAudioElement;
  source: MediaElementAudioSourceNode;
  panner: PannerNode;
  gain: GainNode;
}

/** Original map Sound loops, sharing the original sound manager's context. */
export class MapEnvironmentSound {
  private readonly voices = new Map<string, EnvironmentVoice>();
  private master?: GainNode;
  private map?: EnvironmentSoundMap;
  private revision = 0;
  private volume?: number;
  private readonly resume = (): void => {
    if (!this.voices.size) return;
    if (this.context.state === 'suspended') void this.context.resume();
    for (const voice of this.voices.values()) {
      if (voice.audio.paused) void voice.audio.play().catch(() => {});
    }
  };

  constructor(private readonly camera: Camera, private readonly context: AudioContext) {
    window.addEventListener('pointerdown', this.resume);
    window.addEventListener('keydown', this.resume);
  }

  async load(mapId: number): Promise<void> {
    this.clear();
    if (mapId !== 2 && mapId !== 4 && mapId !== 5 && mapId !== 6 && mapId !== 7 && mapId !== 10 && mapId !== 11 && mapId !== 14 && mapId !== 17 && mapId !== 20 && mapId !== 21 && mapId !== 22) return;
    const revision = this.revision;
    const [map, catalog] = await Promise.all([
      this.json<EnvironmentSoundMap>(`/scene-environment-sound-${String(mapId).padStart(4, '0')}.json`),
      this.json<SkillSoundCatalog>('/audio.json'),
    ]);
    if (revision !== this.revision) return;
    this.map = map;
    this.master = this.context.createGain();
    this.master.gain.value = this.volume ?? catalog.defaultSoundVolume;
    this.master.connect(this.context.destination);
    for (const placement of map.sounds) {
      if (!placement.enabled) continue;
      const asset = catalog.sounds.find(sound => sound.name === placement.name)?.asset;
      if (!asset) throw new Error(`Missing environment sound ${placement.name}`);
      const audio = new Audio(`/${asset}`);
      audio.loop = placement.selector === -1;
      const source = this.context.createMediaElementSource(audio);
      const panner = this.context.createPanner();
      const gain = this.context.createGain();
      panner.panningModel = 'equalpower';
      panner.distanceModel = 'linear';
      panner.refDistance = map.spatial.referenceDistance;
      panner.maxDistance = map.spatial.maxDistance;
      // OpenAL allows rolloff 2; Web Audio's linear panner clamps it to 1.
      panner.rolloffFactor = 0;
      [panner.positionX.value, panner.positionY.value, panner.positionZ.value] = placement.position;
      [panner.orientationX.value, panner.orientationY.value, panner.orientationZ.value] = placement.direction;
      source.connect(panner);
      panner.connect(gain);
      gain.connect(this.master);
      this.voices.set(placement.id, {placement, audio, source, panner, gain});
      this.update();
      void audio.play().catch(() => {});
    }
  }

  private async json<T>(path: string): Promise<T> {
    const response = await fetch(path);
    if (!response.ok) throw new Error(`Unable to load ${path}: ${response.status}`);
    return response.json() as Promise<T>;
  }

  update(): void {
    if (!this.map) return;
    const position = this.camera.globalPosition;
    const forward = this.camera.getForwardRay().direction;
    const up = this.camera.getDirection(Vector3.Up());
    const listener = this.context.listener;
    listener.positionX.value = -position.x;
    listener.positionY.value = position.y;
    listener.positionZ.value = position.z;
    listener.forwardX.value = -forward.x;
    listener.forwardY.value = forward.y;
    listener.forwardZ.value = forward.z;
    listener.upX.value = -up.x;
    listener.upY.value = up.y;
    listener.upZ.value = up.z;
    const {referenceDistance, maxDistance, rolloffFactor} = this.map.spatial;
    for (const voice of this.voices.values()) {
      const [x, y, z] = voice.placement.position;
      const distance = Math.hypot(x + position.x, y - position.y, z - position.z);
      const clamped = Math.max(referenceDistance, Math.min(maxDistance, distance));
      voice.gain.gain.value = voice.placement.gain * Math.max(0,
        1 - rolloffFactor * (clamped - referenceDistance) / (maxDistance - referenceDistance));
    }
  }

  setVolume(volume: number): void {
    this.volume = volume;
    if (this.master) this.master.gain.value = volume;
  }

  private stop(id: string): void {
    const voice = this.voices.get(id);
    if (!voice) return;
    voice.audio.pause();
    voice.source.disconnect();
    voice.panner.disconnect();
    voice.gain.disconnect();
    this.voices.delete(id);
  }

  clear(): void {
    this.revision++;
    for (const id of this.voices.keys()) this.stop(id);
    this.master?.disconnect();
    this.master = undefined;
    this.map = undefined;
  }

  dispose(): void {
    this.clear();
    window.removeEventListener('pointerdown', this.resume);
    window.removeEventListener('keydown', this.resume);
  }
}
