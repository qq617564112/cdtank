interface SummarySoundCatalog {
  defaultSoundVolume: number;
  soundIds: {id: number; asset: string}[];
}

const SOUND_IDS = [29, 30, 31, 35, 36, 37, 38, 39, 40];

/** Source result sounds use global sound IDs, without the skill sound offset. */
export class BattleSummarySound {
  private readonly context = new AudioContext();
  private readonly gain = this.context.createGain();
  private readonly buffers = new Map<number, AudioBuffer>();
  private readonly voices = new Set<AudioBufferSourceNode>();
  private defaultVolume = 0.5;
  private disposed = false;
  private rollingFrame = 0;
  private rolling?: 'scores' | 'growth';
  private rollingVoice?: AudioBufferSourceNode;
  private awardLoop = false;
  private loopVoice?: AudioBufferSourceNode;
  private readonly interaction = (): void => {
    void this.context.resume().then(() => {
      if (!this.disposed && this.awardLoop && !this.loopVoice) this.loopVoice = this.play(38, true);
    }).catch(() => {});
  };

  constructor(private readonly volume?: () => number | undefined) {
    this.gain.connect(this.context.destination);
    window.addEventListener('pointerdown', this.interaction, true);
    window.addEventListener('keydown', this.interaction, true);
    this.interaction();
  }

  async load(signal: AbortSignal): Promise<void> {
    const response = await fetch('/audio.json', {signal});
    if (!response.ok) throw new Error('结算音效载入失败');
    const catalog = await response.json() as SummarySoundCatalog;
    this.defaultVolume = catalog.defaultSoundVolume;
    const buffers = await Promise.all(SOUND_IDS.map(async id => {
      const entry = catalog.soundIds.find(sound => sound.id === id);
      if (!entry) throw new Error(`缺少结算音效：${id}`);
      const response = await fetch(`/${entry.asset}`, {signal});
      if (!response.ok) throw new Error('结算音效载入失败');
      return [id, await this.context.decodeAudioData(await response.arrayBuffer())] as const;
    }));
    if (!this.disposed) buffers.forEach(([id, buffer]) => this.buffers.set(id, buffer));
  }

  play(id: number, loop = false): AudioBufferSourceNode | undefined {
    const buffer = this.buffers.get(id);
    if (this.disposed || !buffer || this.context.state !== 'running') return;
    this.gain.gain.value = this.volume?.() ?? this.defaultVolume;
    const voice = this.context.createBufferSource();
    voice.buffer = buffer;
    voice.loop = loop;
    voice.connect(this.gain);
    voice.onended = () => {this.voices.delete(voice); voice.disconnect();};
    this.voices.add(voice);
    voice.start();
    return voice;
  }

  /** Source rolling states request the short UI29 voice on every frame. */
  setRolling(stage?: 'scores' | 'growth'): void {
    if (stage === this.rolling) return;
    this.rolling = stage;
    window.cancelAnimationFrame(this.rollingFrame);
    if (!stage) return;
    const update = () => {
      if (this.rolling === 'scores') this.rollingVoice?.stop();
      this.rollingVoice = this.play(29);
      if (this.rolling) this.rollingFrame = window.requestAnimationFrame(update);
    };
    this.rollingFrame = window.requestAnimationFrame(update);
  }

  /** Original state5 saves the UI38 handle; state6 stops that handle. */
  setAwardLoop(active: boolean): void {
    if (active === this.awardLoop) return;
    this.awardLoop = active;
    if (active) this.loopVoice = this.play(38, true);
    else {this.loopVoice?.stop(); this.loopVoice = undefined;}
  }

  stop(): void {
    this.setRolling();
    this.rollingVoice = undefined;
    this.setAwardLoop(false);
    for (const voice of this.voices) voice.stop();
    this.voices.clear();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.stop();
    window.removeEventListener('pointerdown', this.interaction, true);
    window.removeEventListener('keydown', this.interaction, true);
    this.gain.disconnect();
    void this.context.close();
  }
}
