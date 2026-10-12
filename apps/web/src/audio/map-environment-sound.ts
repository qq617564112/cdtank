import {Camera} from '@babylonjs/core';
import {setCameraSpatialListener} from './spatial-listener';
import type {EffectVec3} from '../render/effects/common/types';
import type {SkillSoundCatalog} from './effect-skill-sound';
import {loadStaticJson, prepareStaticResourceUrl, staticResourceUrl} from '../assets/static-resources';

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
      if (voice.audio.paused) this.startVoice(voice);
    }
  };

  constructor(private readonly camera: Camera, private readonly context: AudioContext) {
    window.addEventListener('pointerdown', this.resume);
    window.addEventListener('keydown', this.resume);
  }

  async load(mapId: number): Promise<void> {
    this.clear();
    if (!Number.isInteger(mapId) || mapId < 1 || mapId > 25) return;
    const revision = this.revision;
    const [map, catalog] = await Promise.all([
      loadStaticJson<EnvironmentSoundMap>(`/data/maps/${String(mapId).padStart(4, '0')}/environment-sound.json`),
      loadStaticJson<SkillSoundCatalog>('/manifests/audio.json'),
    ]);
    if (revision !== this.revision) return;
    const assets = new Map<string, string>();
    for (const placement of map.sounds) {
      if (!placement.enabled) continue;
      const asset = catalog.sounds.find(sound => sound.name === placement.name)?.asset;
      if (!asset) throw new Error(`地图环境声音资源缺失：${placement.name}`);
      assets.set(placement.id, asset);
    }
    if (!assets.size) return;
    await Promise.all([...new Set(assets.values())].map(asset => prepareStaticResourceUrl(`/${asset}`)));
    if (revision !== this.revision) return;
    this.map = map;
    this.master = this.context.createGain();
    this.master.gain.value = this.volume ?? catalog.defaultSoundVolume;
    this.master.connect(this.context.destination);
    for (const placement of map.sounds) {
      const asset = assets.get(placement.id);
      if (!asset) continue;
      const audio = new Audio(staticResourceUrl(`/${asset}`));
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
      const voice: EnvironmentVoice = {placement, audio, source, panner, gain};
      this.voices.set(placement.id, voice);
      audio.onended = () => this.stop(placement.id);
      audio.onerror = () => this.stop(placement.id);
      this.update();
      this.startVoice(voice);
    }
  }

  private startVoice(voice: EnvironmentVoice): void {
    void voice.audio.play().catch(error => {
      if (error?.name !== 'NotAllowedError' && this.voices.get(voice.placement.id) === voice) {
        this.stop(voice.placement.id);
      }
    });
  }

  update(): void {
    if (!this.map) return;
    const position = this.camera.globalPosition;
    setCameraSpatialListener(this.context.listener, this.camera);
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
    this.voices.delete(id);
    voice.audio.onended = null;
    voice.audio.onerror = null;
    voice.audio.pause();
    voice.audio.removeAttribute('src');
    voice.audio.load();
    voice.source.disconnect();
    voice.panner.disconnect();
    voice.gain.disconnect();
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
