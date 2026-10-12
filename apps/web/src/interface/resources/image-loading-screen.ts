import {createElement} from 'react';
import type {Root} from 'react-dom/client';
import {getLoadingArtwork, LoadingPage} from './loading-page';
import {decodeImageRegion} from '../../assets/image-resources';
import {DialogButton} from './dialog-button';

export class ImageLoadingScreen {
  private readonly background = 1 + Math.floor(Math.random() * 5);
  private readonly images = Object.values(getLoadingArtwork(this.background));
  private artworkReady = false;
  private progress = 0;
  private status = '正在准备图片资源…';
  private details = '';
  private failed = false;

  constructor(private readonly root: Root, private readonly onRetry: () => void) {
    this.render();
  }

  async prepare(signal: AbortSignal): Promise<void> {
    signal.throwIfAborted();
    await Promise.all([
      ...this.images.map(url => decodeImageRegion(url, signal)),
      document.fonts.load('700 39px "HappyZcool-2016"', 'LOADING... 0123456789%'),
    ]);
    signal.throwIfAborted();
    this.artworkReady = true;
    this.render();
  }

  begin(): void {
    this.status = '正在准备图片资源…';
    this.progress = 0;
    this.details = '';
    this.failed = false;
    this.render();
  }

  update(progress: number, status?: string): void {
    this.progress = progress;
    if (status !== undefined) this.status = status;
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
      error: this.failed ? this.status : undefined,
      details: this.details,
      actions: this.failed ? createElement(DialogButton, {
        type: 'button', autoFocus: true, onClick: this.onRetry,
      }, '重新载入') : undefined,
    }));
  }
}
