export interface PageMusicPlayer {
  playPage(page: 'lobby' | 'waiting'): Promise<void>;
  play(mode: number, mapId: number): Promise<void>;
  playResult(resultFlag: 1 | 2): Promise<void>;
  dispose(): void;
}

/** Routes the active original page through one music player. */
export class PageMusic {
  private selected?: string;
  private disposed = false;

  constructor(private readonly player: PageMusicPlayer,
    private readonly report: (error: unknown) => void) {}

  lobby(): void {
    this.select('lobby', () => this.player.playPage('lobby'));
  }

  room(phase: string, mode: number, mapId: number, resultFlag?: 1 | 2, round?: number, roomId?: string): void {
    if (phase === 'WAITING' || phase === 'LOADING') this.select('waiting', () => this.player.playPage('waiting'));
    else if (phase === 'FINISHED' && resultFlag !== undefined && round !== undefined) {
      this.select(`result:${roomId}:${round}:${resultFlag}`, () => this.player.playResult(resultFlag));
    }
    else this.select(`map:${mode}:${mapId}`, () => this.player.play(mode, mapId));
  }

  private select(key: string, play: () => Promise<void>): void {
    if (this.disposed || this.selected === key) return;
    this.selected = key;
    void play().catch(error => {
      if (!this.disposed && this.selected === key) this.report(error);
    });
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.selected = undefined;
    this.player.dispose();
  }
}
