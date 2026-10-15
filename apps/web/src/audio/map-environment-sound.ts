import {Camera} from '@babylonjs/core';
import {setCameraSpatialListener} from './spatial-listener';
import type {EffectVec3} from '../render/effects/common/types';
import type {SkillSoundCatalog} from './effect-skill-sound';
import {loadStaticJson} from '../assets/static-resources';
import {listenForAudioInteraction} from './audio-interaction';
import {loadAudioBuffer, releaseAudioBuffer} from './audio-resources';

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
  source: AudioBufferSourceNode;
  panner: PannerNode;
  gain: GainNode;
}

/** Original map Sound loops, sharing the original sound manager's context. */
export class MapEnvironmentSound {
  private readonly voices = new Map<string, EnvironmentVoice>();
  private readonly decodedAssets = new Set<string>();
  private master?: GainNode;
  private map?: EnvironmentSoundMap;
  private revision = 0;
  private volume?: number;
  private attenuationX = NaN;
  private attenuationY = NaN;
  private attenuationZ = NaN;
  private referenceDistance = NaN;
  private maxDistance = NaN;
  private rolloffFactor = NaN;
  private readonly removeInteraction: () => void;
  private readonly resume = (): void => {
    if (!this.voices.size) return;
    if (this.context.state === 'suspended') {
      void this.context.resume().catch(() => {});
    }
  };

  constructor(private readonly camera: Camera, private readonly context: AudioContext) {
    this.removeInteraction = listenForAudioInteraction(this.resume);
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
    for (const asset of assets.values()) this.decodedAssets.add(asset);
    const buffers = new Map(await Promise.all([...new Set(assets.values())].map(async asset =>
      [asset, await loadAudioBuffer(`/${asset}`, this.context)] as const)));
    if (revision !== this.revision) return;
    this.map = map;
    this.master = this.context.createGain();
    this.master.gain.value = this.volume ?? catalog.defaultSoundVolume;
    this.master.connect(this.context.destination);
    for (const placement of map.sounds) {
      const asset = assets.get(placement.id);
      if (!asset) continue;
      const source = this.context.createBufferSource();
      source.buffer = buffers.get(asset)!;
      source.loop = placement.selector === -1;
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
      const voice: EnvironmentVoice = {placement, source, panner, gain};
      this.voices.set(placement.id, voice);
      source.onended = () => this.stop(placement.id);
      source.start();
    }
    this.update();
    this.resume();
  }

  update(): void {
    if (!this.map) return;
    const position = this.camera.globalPosition;
    setCameraSpatialListener(this.context.listener, this.camera);
    const {referenceDistance, maxDistance, rolloffFactor} = this.map.spatial;
    if (position.x === this.attenuationX && position.y === this.attenuationY && position.z === this.attenuationZ &&
        referenceDistance === this.referenceDistance && maxDistance === this.maxDistance && rolloffFactor === this.rolloffFactor) return;
    this.attenuationX = position.x; this.attenuationY = position.y; this.attenuationZ = position.z;
    this.referenceDistance = referenceDistance; this.maxDistance = maxDistance; this.rolloffFactor = rolloffFactor;
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
    voice.source.onended = null;
    voice.source.stop();
    voice.source.disconnect();
    voice.panner.disconnect();
    voice.gain.disconnect();
  }

  clear(): void {
    this.revision++;
    this.attenuationX = NaN;
    for (const id of this.voices.keys()) this.stop(id);
    for (const asset of this.decodedAssets) releaseAudioBuffer(`/${asset}`);
    this.decodedAssets.clear();
    this.master?.disconnect();
    this.master = undefined;
    this.map = undefined;
  }

  dispose(): void {
    this.clear();
    this.removeInteraction();
  }
}
