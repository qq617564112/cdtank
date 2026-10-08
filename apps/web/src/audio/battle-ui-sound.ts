interface BattleUiSoundCatalog {
  defaultSoundVolume: number;
  soundIds: {id: number; asset: string}[];
}

const SOURCE_SOUND_IDS = [28, 42, 43, 72] as const;
type BattleUiSoundId = typeof SOURCE_SOUND_IDS[number];

/** Original UI one-shots for countdown, Fight, local reload start and empty hotkeys. */
export class BattleUiSound {
  private context?: AudioContext;
  private gain?: GainNode;
  private respawnCountdownGain?: GainNode;
  private defaultVolume = 0.5;
  private readonly buffers = new Map<BattleUiSoundId, AudioBuffer>();
  private readonly voices = new Set<AudioBufferSourceNode>();
  private readonly status = document.createElement('output');
  private readonly history: {soundId: BattleUiSoundId; contextTime: number}[] = [];
  private generation = 0;
  private active = false;
  private disposed = false;
  private readonly interaction = (): void => {this.resume();};

  constructor(private readonly volume?: () => number | undefined) {
    this.status.hidden = true;
    this.status.dataset.sourceAudio = 'battle-ui-sound';
    document.body.append(this.status);
    window.addEventListener('pointerdown', this.interaction);
    window.addEventListener('keydown', this.interaction);
    this.publish();
  }

  async load(): Promise<void> {
    this.stop();
    const generation = this.generation;
    const response = await fetch('/audio.json');
    if (!response.ok) throw new Error('原战斗提示音目录载入失败');
    const catalog = await response.json() as BattleUiSoundCatalog;
    if (generation !== this.generation) return;
    this.defaultVolume = catalog.defaultSoundVolume;
    this.context ??= new AudioContext();
    if (!this.gain) {
      this.gain = this.context.createGain();
      this.gain.connect(this.context.destination);
      this.respawnCountdownGain = this.context.createGain();
      this.respawnCountdownGain.gain.value = 0.8;
      this.respawnCountdownGain.connect(this.gain);
    }
    const decoded = await Promise.all(SOURCE_SOUND_IDS.map(async id => {
      const cached = this.buffers.get(id);
      if (cached) return [id, cached] as const;
      const entry = catalog.soundIds.find(sound => sound.id === id);
      if (!entry) throw new Error(`缺少原战斗提示音：${id}`);
      const response = await fetch(`/${entry.asset}`);
      if (!response.ok) throw new Error(`原战斗提示音载入失败：${id}`);
      return [id, await this.context!.decodeAudioData(await response.arrayBuffer())] as const;
    }));
    if (generation !== this.generation) return;
    decoded.forEach(([id, buffer]) => this.buffers.set(id, buffer));
    this.active = true;
    this.gain.gain.value = this.readVolume();
    this.resume();
    this.publish();
  }

  play(id: BattleUiSoundId): void {
    const buffer = this.buffers.get(id);
    if (!this.active || !buffer || this.context?.state !== 'running' || !this.gain) return;
    this.gain.gain.value = this.readVolume();
    const voice = this.context.createBufferSource();
    voice.buffer = buffer;
    voice.connect(id === 42 ? this.respawnCountdownGain! : this.gain);
    voice.onended = () => {
      this.voices.delete(voice);
      voice.disconnect();
      this.publish();
    };
    this.voices.add(voice);
    voice.start();
    this.history.push({soundId: id, contextTime: this.context.currentTime});
    if (this.history.length > 10) this.history.shift();
    this.publish();
  }

  reset(): void {
    for (const voice of this.voices) {
      voice.onended = null;
      voice.stop();
      voice.disconnect();
    }
    this.voices.clear();
    this.history.length = 0;
    this.publish();
  }

  stop(): void {
    this.generation++;
    this.active = false;
    this.reset();
    if (this.gain) this.gain.gain.value = 0;
    this.publish();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.stop();
    window.removeEventListener('pointerdown', this.interaction);
    window.removeEventListener('keydown', this.interaction);
    this.respawnCountdownGain?.disconnect();
    this.gain?.disconnect();
    void this.context?.close();
    this.context = undefined;
    this.gain = undefined;
    this.respawnCountdownGain = undefined;
    this.status.remove();
  }

  private readVolume(): number {
    const volume = this.volume?.();
    if (volume === undefined || !Number.isFinite(volume)) return this.defaultVolume;
    return Math.max(0, Math.min(1, volume));
  }

  private resume(): void {
    if (!this.active || !this.context || this.context.state !== 'suspended') return;
    void this.context.resume().then(() => {this.publish();}).catch(() => {this.publish();});
  }

  private publish(): void {
    this.status.dataset.state = this.active ? (this.context?.state ?? 'loading') : 'stopped';
    this.status.dataset.voices = String(this.voices.size);
    this.status.dataset.volume = String(this.readVolume());
    this.status.dataset.events = JSON.stringify(this.history);
  }
}
