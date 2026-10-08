import {gameContent} from '../../../shared/content/catalog';
import type {MsgRoomEvent} from '../../../shared/protocols/MsgRoomEvent';
import type {MsgRoomSnapshot} from '../../../shared/protocols/MsgRoomSnapshot';

interface Position {x: number; y: number; z: number}
interface Voice {
  source: AudioBufferSourceNode;
  panner: PannerNode;
  attenuation: GainNode;
  position: Position;
}
interface SoundCatalog {
  defaultSoundVolume: number;
  soundIds: {id: number; asset: string}[];
  battleFire: {skillId: number; soundId: number; asset: string}[];
  battleKill: {
    selections: {tankType: number; soundId: number; asset: string}[];
    tankTypes: {id: number; type: number}[];
    spatial: {referenceDistance: number; maxDistance: number; rolloffFactor: number;
      distanceModel: DistanceModelType};
  };
}

/** Original role-owned battle sounds; all coordinates passed here are native XYZ. */
export class BattleSound {
  private context?: AudioContext;
  private gain?: GainNode;
  private catalog?: SoundCatalog;
  private readonly buffers = new Map<number, AudioBuffer>();
  private readonly voices = new Set<Voice>();
  private readonly status = document.createElement('output');
  private readonly history: object[] = [];
  private generation = 0;
  private active = false;
  private volume?: number;
  private listenerPosition: Position = {x: 0, y: 0, z: 0};
  private readonly interaction = (): void => {this.resume();};

  constructor() {
    this.status.hidden = true;
    this.status.dataset.sourceAudio = 'battle-sound';
    document.body.append(this.status);
    window.addEventListener('pointerdown', this.interaction);
    window.addEventListener('keydown', this.interaction);
    this.publish();
  }

  async start(): Promise<void> {
    this.stop();
    const generation = this.generation;
    const response = await fetch('/audio.json');
    if (!response.ok) throw new Error('原战斗音效目录载入失败');
    const catalog = await response.json() as SoundCatalog;
    if (generation !== this.generation) return;
    const context = this.context ??= new AudioContext();
    if (!this.gain) {
      this.gain = this.context.createGain();
      this.gain.connect(this.context.destination);
    }
    const definitions = [...gameContent().items.values()].flatMap(item => item.resources.fireSound ? [item.resources.fireSound] : [])
      .concat([...gameContent().tanks.values()].map(tank => tank.resources.destroySound));
    const sounds = new Map(definitions.map(sound => [sound.id, sound]));
    const decoded = await Promise.all([...sounds.values()].map(async entry => {
      const cached = this.buffers.get(entry.id);
      if (cached) return [entry.id, cached] as const;
      const response = await fetch(`/${entry.asset}`);
      if (!response.ok) throw new Error(`战斗声音载入失败：${entry.id}`);
      return [entry.id, await context.decodeAudioData(await response.arrayBuffer())] as const;
    }));
    if (generation !== this.generation) return;
    decoded.forEach(([id, buffer]) => this.buffers.set(id, buffer));
    this.catalog = catalog;
    this.active = true;
    this.gain.gain.value = this.volume ?? catalog.defaultSoundVolume;
    this.resume();
    this.publish();
  }

  event(event: MsgRoomEvent, snapshot: MsgRoomSnapshot, localId: string): void {
    if (!['fire', 'destroy'].includes(event.type)) return;
    this.playEvent(event, snapshot, localId);
  }

  /** Original4247aa remote tail calls423092 with message+10, without BeforeShot. */
  shotItemResult(event: MsgRoomEvent, snapshot: MsgRoomSnapshot, localId: string,
    itemId: number): void {
    if (event.playerId === localId || !gameContent().items.get(itemId)?.runtime.remoteShotResult) return;
    this.playEvent(event, snapshot, localId, itemId);
  }

  private playEvent(event: MsgRoomEvent, snapshot: MsgRoomSnapshot, localId: string,
    shotItemId?: number): void {
    if (!this.active || !this.catalog || event.roomId !== snapshot.roomId) return;
    const attacker = snapshot.players.find(player => player.id === event.playerId);
    const local = snapshot.players.find(player => player.id === localId);
    if (!attacker || !local) return;
    if (shotItemId === undefined && event.type === 'destroy' && snapshot.mode <= 3 && attacker.team !== local.team) return;
    // Browser-denied one-shot sounds are dropped, never replayed on a later interaction.
    if (this.context?.state !== 'running' || !this.gain) return;
    const rules = this.catalog.battleKill;
    let soundId: number | undefined;
    if (event.type === 'fire' || shotItemId !== undefined) {
      soundId = gameContent().items.get(shotItemId ?? event.skillId ?? 0)?.resources.fireSound?.id;
    } else {
      soundId = gameContent().tanks.get(attacker.tankId)?.resources.destroySound.id;
    }
    if (soundId === undefined) return;
    const buffer = this.buffers.get(soundId);
    if (!buffer) return;
    const source = this.context.createBufferSource();
    const panner = this.context.createPanner();
    const attenuation = this.context.createGain();
    source.buffer = buffer;
    source.loop = false;
    panner.panningModel = 'equalpower';
    panner.distanceModel = rules.spatial.distanceModel;
    panner.refDistance = rules.spatial.referenceDistance;
    panner.maxDistance = rules.spatial.maxDistance;
    // Web Audio clamps linear rolloff to 1; the original OpenAL factor is 2.
    panner.rolloffFactor = 0;
    panner.positionX.value = attacker.x;
    panner.positionY.value = attacker.y;
    panner.positionZ.value = attacker.z;
    source.connect(panner);
    panner.connect(attenuation);
    attenuation.connect(this.gain);
    const voice = {source, panner, attenuation,
      position: {x: attacker.x, y: attacker.y, z: attacker.z}};
    this.attenuate(voice);
    this.voices.add(voice);
    source.onended = () => {
      source.disconnect();
      panner.disconnect();
      attenuation.disconnect();
      this.voices.delete(voice);
      this.publish();
    };
    source.start();
    this.history.push({soundId, type: event.type, skillId: shotItemId ?? event.skillId,
      playerId: attacker.id, targetId: event.targetId,
      x: attacker.x, y: attacker.y, z: attacker.z, contextTime: this.context.currentTime});
    if (this.history.length > 10) this.history.shift();
    this.publish();
  }

  listener(position: Position, forward: Position, up: Position): void {
    if (!this.active || !this.context) return;
    const listener = this.context.listener;
    this.listenerPosition = {...position};
    listener.positionX.value = position.x;
    listener.positionY.value = position.y;
    listener.positionZ.value = position.z;
    listener.forwardX.value = forward.x;
    listener.forwardY.value = forward.y;
    listener.forwardZ.value = forward.z;
    listener.upX.value = up.x;
    listener.upY.value = up.y;
    listener.upZ.value = up.z;
    this.voices.forEach(voice => {this.attenuate(voice);});
  }

  private attenuate(voice: Voice): void {
    if (!this.catalog) return;
    const {referenceDistance, maxDistance, rolloffFactor} = this.catalog.battleKill.spatial;
    const distance = Math.hypot(voice.position.x - this.listenerPosition.x,
      voice.position.y - this.listenerPosition.y, voice.position.z - this.listenerPosition.z);
    const clamped = Math.max(referenceDistance, Math.min(maxDistance, distance));
    voice.attenuation.gain.value = Math.max(0, Math.min(1,
      1 - rolloffFactor * (clamped - referenceDistance) / (maxDistance - referenceDistance)));
  }

  setVolume(volume: number): void {
    if (!Number.isFinite(volume)) return;
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.gain && this.active) this.gain.gain.value = this.volume;
    this.publish();
  }

  private resume(): void {
    if (!this.active || !this.context || this.context.state !== 'suspended') return;
    void this.context.resume().then(() => {this.publish();}).catch(() => {this.publish();});
  }

  stop(): void {
    this.generation++;
    this.active = false;
    for (const voice of this.voices) {
      voice.source.onended = null;
      voice.source.stop();
      voice.source.disconnect();
      voice.panner.disconnect();
      voice.attenuation.disconnect();
    }
    this.voices.clear();
    this.history.length = 0;
    if (this.gain) this.gain.gain.value = 0;
    this.publish();
  }

  dispose(): void {
    this.stop();
    window.removeEventListener('pointerdown', this.interaction);
    window.removeEventListener('keydown', this.interaction);
    this.gain?.disconnect();
    if (this.context) void this.context.close();
    this.gain = undefined;
    this.context = undefined;
    this.buffers.clear();
    this.status.remove();
  }

  private publish(): void {
    this.status.dataset.state = this.active ? (this.context?.state ?? 'loading') : 'stopped';
    this.status.dataset.voices = String(this.voices.size);
    this.status.dataset.volume = String(this.volume ?? this.catalog?.defaultSoundVolume ?? 0.5);
    this.status.dataset.events = JSON.stringify(this.history);
  }
}
