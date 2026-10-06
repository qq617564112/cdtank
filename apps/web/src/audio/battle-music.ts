interface MusicCatalog {
  defaultMusicVolume: number;
  music: {name: string; asset: string}[];
  maps: {mode: number; mapId: number; musicId: number; asset: string}[];
}

/** Original map selection (MusicFile + 191), using unchanged source MP3 bytes. */
export class BattleMusic {
  private readonly audio = document.createElement('audio');
  private generation = 0;
  private requestGeneration = 0;
  private catalog?: Promise<MusicCatalog>;
  private desired = false;
  private volume?: number;
  private disposed = false;
  private readonly interaction = (): void => {this.resume();};
  private readonly audioEnded = (): void => {
    if (this.audio.loop) return;
    this.desired = false;
    this.audio.dataset.state = 'ended';
  };
  private readonly audioError = (): void => {this.audio.dataset.state = 'error';};

  constructor() {
    this.audio.loop = true;
    this.audio.preload = 'metadata';
    this.audio.dataset.sourceAudio = 'battle-music';
    this.audio.hidden = true;
    document.body.append(this.audio);
    // Retry a browser-denied play on a real interaction while this battle is active.
    window.addEventListener('pointerdown', this.interaction);
    window.addEventListener('keydown', this.interaction);
    this.audio.addEventListener('error', this.audioError);
    this.audio.addEventListener('ended', this.audioEnded);
  }

  async play(mode: number, mapId: number): Promise<void> {
    await this.select(catalog => {
      const track = catalog.maps.find(track => track.mode === mode && track.mapId === mapId);
      if (!track) throw new Error(`缺少原战场音乐映射：${mode}/${mapId}`);
      return track;
    });
  }

  /** Original roomlist/room_main activation selects IDs183/184 with loop count-1. */
  async playPage(page: 'lobby' | 'waiting'): Promise<void> {
    await this.select(catalog => {
      const musicId = page === 'lobby' ? 183 : 184;
      const name = page === 'lobby' ? 'UIM01' : 'UIM02';
      const track = catalog.music.find(track => track.name === name);
      if (!track) throw new Error(`缺少原页面音乐：${name}`);
      return {...track, musicId};
    });
  }

  /** Original result message+d4 selects190/191 with play count1. */
  async playResult(resultFlag: 1 | 2): Promise<void> {
    await this.select(catalog => {
      const musicId = resultFlag === 1 ? 190 : 191;
      const name = resultFlag === 1 ? 'UIM08' : 'UIM09';
      const track = catalog.music.find(track => track.name === name);
      if (!track) throw new Error(`缺少原结算音乐：${name}`);
      return {...track, musicId};
    }, false);
  }

  private async select(resolve: (catalog: MusicCatalog) => {musicId: number; asset: string},
    loop = true): Promise<void> {
    if (this.disposed) return;
    const request = ++this.requestGeneration;
    this.catalog ??= fetch('/audio.json').then(async response => {
      if (!response.ok) throw new Error('原战场音乐目录载入失败');
      return await response.json() as MusicCatalog;
    }).catch(error => {this.catalog = undefined; throw error;});
    const catalog = await this.catalog;
    if (request !== this.requestGeneration || this.disposed) return;
    const track = resolve(catalog);
    if (this.audio.dataset.musicId === String(track.musicId) && this.audio.loop === loop) {
      this.resume();
      return;
    }
    this.stop();
    this.audio.loop = loop;
    this.audio.volume = this.volume ?? catalog.defaultMusicVolume;
    this.audio.src = `/${track.asset}`;
    this.audio.dataset.musicId = String(track.musicId);
    this.desired = true;
    this.resume();
  }

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    this.audio.volume = this.volume;
  }

  private resume(): void {
    if (!this.desired || !this.audio.paused) return;
    const generation = this.generation;
    void this.audio.play().then(() => {
      if (generation === this.generation) this.audio.dataset.state = 'playing';
    }).catch(error => {
      if (generation !== this.generation) return;
      this.audio.dataset.state = error instanceof DOMException && error.name === 'NotAllowedError'
        ? 'awaiting-interaction' : 'error';
    });
  }

  stop(): void {
    this.requestGeneration++;
    this.generation++;
    this.desired = false;
    this.audio.pause();
    this.audio.removeAttribute('src');
    this.audio.load();
    delete this.audio.dataset.musicId;
    this.audio.dataset.state = 'stopped';
  }

  dispose(): void {
    this.stop();
    this.disposed = true;
    window.removeEventListener('pointerdown', this.interaction);
    window.removeEventListener('keydown', this.interaction);
    this.audio.removeEventListener('error', this.audioError);
    this.audio.removeEventListener('ended', this.audioEnded);
    this.audio.remove();
  }
}
