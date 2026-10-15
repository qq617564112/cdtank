import {loadStaticJson} from '../assets/static-resources';
import {loadStaticResourceBlob} from '../assets/static-resource-cache';
import {listenForAudioInteraction} from './audio-interaction';

interface MusicCatalog {
  defaultMusicVolume: number;
  music: {name: string; asset: string}[];
  maps: {mode: number; mapId: number; musicId: number; asset: string}[];
}

/** Scene themes for maps absent from m001–m005; see docs/playable-maps.md. */
const SCENE_MUSIC_FILES: Readonly<Record<number, number>> = {
  1: 4, // 不毛岛：沙漠遗迹。
  3: 7, // 蛋糕南路：沿用夕阳蛋糕南路。
  8: 6, // 废弃魔王路：沿用约翰的路。
  9: 5, // 秘密工厂迷宫：沿用血战秘密工厂。
  12: 2, // 不是约翰的路田园：沿用田野路。
  13: 6, // 凄凉魔王路：沿用约翰的路。
  15: 5, // 秘密工厂仓库：沿用血战秘密工厂。
  16: 1, // 仙剑岛秘密仙境：沿用仙剑岛庭院大战。
  19: 2, // 田野路南瓜大丰收：沿用田野路南瓜田。
  23: 1, // 春节版仙剑岛：沿用仙剑岛庭院大战。
  24: 10, // 圣诞节版魔王山：沿用魔王山迷宫。
  25: 3, // 情人节版早安公园：沿用早安一路。
};

/** Map music uses original tracks and scene themes, with unchanged source MP3 bytes. */
export class BattleMusic {
  private readonly audio = document.createElement('audio');
  private sourceUrl?: string;
  private generation = 0;
  private requestGeneration = 0;
  private desired = false;
  private volume?: number;
  private disposed = false;
  private readonly interaction = (): void => {this.resume();};
  private readonly removeInteraction: () => void;
  private readonly audioEnded = (): void => {
    if (this.audio.loop) return;
    this.desired = false;
    this.audio.dataset.state = 'ended';
  };
  private readonly audioError = (): void => {
    this.audio.dataset.state = 'error';
    this.audio.dataset.error = String(this.audio.error?.code ?? 0);
  };

  constructor() {
    this.audio.loop = true;
    this.audio.preload = 'metadata';
    this.audio.dataset.sourceAudio = 'battle-music';
    this.audio.dataset.state = 'stopped';
    this.audio.hidden = true;
    document.body.append(this.audio);
    // Retry a browser-denied play on a real interaction while this battle is active.
    this.removeInteraction = listenForAudioInteraction(this.interaction);
    this.audio.addEventListener('error', this.audioError);
    this.audio.addEventListener('ended', this.audioEnded);
  }

  /** Download this map's track and both possible result tracks before battle. */
  async prepare(mode: number, mapId: number): Promise<void> {
    const catalog = await loadStaticJson<MusicCatalog>('/manifests/audio.json');
    const map = this.mapTrack(catalog, mode, mapId);
    const tracks = [map, ...['UIM08', 'UIM09'].map(name => {
      const track = catalog.music.find(track => track.name === name);
      if (!track) throw new Error(`缺少原结算音乐：${name}`);
      return track;
    })];
    await Promise.all(tracks.map(async track => {await loadStaticResourceBlob(`/${track.asset}`);}));
  }

  async play(mode: number, mapId: number): Promise<void> {
    await this.select(catalog => this.mapTrack(catalog, mode, mapId));
  }

  private mapTrack(catalog: MusicCatalog, mode: number, mapId: number): {musicId: number; asset: string} {
    const original = catalog.maps.find(track => track.mode === mode && track.mapId === mapId)
      ?? catalog.maps.find(track => track.mapId === mapId);
    if (original) return original;
    const musicFile = SCENE_MUSIC_FILES[mapId];
    const name = `GAM${String(musicFile).padStart(2, '0')}`;
    const track = catalog.music.find(track => track.name === name);
    if (!track) throw new Error(`缺少战场音乐映射：${mode}/${mapId}`);
    return {...track, musicId: musicFile + 191};
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
    if (!this.desired) this.audio.dataset.state = 'loading';
    const catalog = await loadStaticJson<MusicCatalog>('/manifests/audio.json');
    if (request !== this.requestGeneration || this.disposed) return;
    const track = resolve(catalog);
    if (this.audio.dataset.musicId === String(track.musicId) && this.audio.loop === loop) {
      this.resume();
      return;
    }
    const blob = await loadStaticResourceBlob(`/${track.asset}`);
    if (request !== this.requestGeneration || this.disposed) return;
    const url = URL.createObjectURL(blob.slice(0, blob.size, 'audio/mpeg'));
    this.stop();
    this.sourceUrl = url;
    this.audio.loop = loop;
    this.audio.volume = this.volume ?? catalog.defaultMusicVolume;
    this.audio.src = url;
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
    this.audio.dataset.state = 'starting';
    void this.audio.play().then(() => {
      if (generation !== this.generation) return;
      this.audio.dataset.state = 'playing';
      delete this.audio.dataset.error;
    }).catch(error => {
      if (generation !== this.generation) return;
      this.audio.dataset.error = error instanceof Error ? error.name : 'UnknownError';
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
    if (this.sourceUrl) URL.revokeObjectURL(this.sourceUrl);
    this.sourceUrl = undefined;
    delete this.audio.dataset.musicId;
    delete this.audio.dataset.error;
    this.audio.dataset.state = 'stopped';
  }

  dispose(): void {
    this.stop();
    this.disposed = true;
    this.removeInteraction();
    this.audio.removeEventListener('error', this.audioError);
    this.audio.removeEventListener('ended', this.audioEnded);
    this.audio.remove();
  }
}
