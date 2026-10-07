import {createElement} from 'react';
import type {Root} from 'react-dom/client';
import type {ImageLoadingProgress} from '../../assets/preload-images';
import {getLoadingArtwork, LoadingPage} from './loading-page';

export class ImageLoadingScreen {
  private readonly background = 1 + Math.floor(Math.random() * 5);
  private readonly images = Object.values(getLoadingArtwork(this.background)).map(source => {
    const image = new Image();
    image.src = source;
    return image;
  });
  private artworkReady = false;
  private progress?: number;
  private status = '正在准备图片资源…';
  private details = '';
  private failed = false;

  constructor(private readonly root: Root, private readonly onRetry: () => void) {
    this.render();
  }

  async prepare(signal: AbortSignal): Promise<void> {
    signal.throwIfAborted();
    const images = this.images;
    const abort = () => {for (const image of images) image.src = '';};
    signal.addEventListener('abort', abort, {once: true});
    try {
      await Promise.all(images.map(async image => {
        if (image.complete && image.naturalWidth === 0) {
          const source = image.src;
          image.src = '';
          image.src = source;
        }
        await image.decode();
      }));
    } finally {
      signal.removeEventListener('abort', abort);
    }
    signal.throwIfAborted();
    this.artworkReady = true;
    this.render();
  }

  begin(): void {
    this.status = '正在准备图片资源…';
    this.progress = undefined;
    this.details = '';
    this.failed = false;
    this.render();
  }

  update(progress: ImageLoadingProgress): void {
    const fraction = Math.min(1, progress.loadedBytes / Math.max(1, progress.totalBytes));
    const percent = Math.floor(fraction * 100);
    this.progress = fraction;
    this.status = progress.completed === progress.total ? '图片已就绪，正在进入游戏…' : `正在加载图片资源 · ${percent}%`;
    const mib = (bytes: number) => (bytes / 1024 / 1024).toFixed(1);
    const cached = progress.cached > 0 ? ` · 本地复用 ${progress.cached.toLocaleString()} 张` : '';
    this.details = `已就绪 ${progress.completed.toLocaleString()} / ${progress.total.toLocaleString()} 张${cached} · 资源大小 ${mib(progress.loadedBytes)} / ${mib(progress.totalBytes)} MB`;
    this.render();
  }

  fail(error: unknown): void {
    this.status = '游戏资源加载失败';
    this.details = error instanceof Error ? error.message : String(error);
    this.failed = true;
    this.render();
  }

  private render(): void {
    this.root.render(createElement(LoadingPage, {
      className: 'image-loading-screen',
      'aria-label': '游戏资源加载',
      'aria-busy': !this.failed,
      background: this.background,
      artworkReady: this.artworkReady,
      progress: this.progress,
      status: this.status,
      details: this.details,
      actions: this.failed ? createElement('button', {
        type: 'button', autoFocus: true, onClick: this.onRetry,
      }, '重新载入') : undefined,
    }));
  }
}
