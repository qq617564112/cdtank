import {createElement} from 'react';
import type {Root} from 'react-dom/client';
import type {ImageLoadingProgress} from '../../assets/preload-images';
import {getLoadingArtwork, LoadingPage} from './loading-page';
import {decodeImage} from '../../assets/image-resources';

export class ImageLoadingScreen {
  private readonly background = 1 + Math.floor(Math.random() * 5);
  private readonly images = Object.values(getLoadingArtwork(this.background));
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
    await Promise.all(this.images.map(url => decodeImage(url, signal)));
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
    const fraction = Math.min(1, (progress.completed + progress.decoded)
      / Math.max(1, progress.total + progress.decodeTotal));
    const percent = Math.floor(fraction * 100);
    this.progress = fraction;
    this.status = progress.decoded === progress.decodeTotal ? '正在准备游戏界面…'
      : progress.phase === 'decode' ? `正在解码图片 · ${percent}%` : `正在下载图片 · ${percent}%`;
    const mib = (bytes: number) => (bytes / 1024 / 1024).toFixed(1);
    const cached = progress.cached > 0 ? ` · 本地复用 ${progress.cached.toLocaleString()} 张` : '';
    this.details = `已下载 ${progress.completed.toLocaleString()} / ${progress.total.toLocaleString()} 张${cached}`
      + ` · 已解码 ${progress.decoded.toLocaleString()} / ${progress.decodeTotal.toLocaleString()} 张`
      + ` · 资源大小 ${mib(progress.loadedBytes)} / ${mib(progress.totalBytes)} MB`;
    this.render();
  }

  preparingContentAndUi(): void {
    this.status = '正在准备游戏内容与界面…';
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
