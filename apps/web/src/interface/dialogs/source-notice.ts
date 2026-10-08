import type {HomeSourceUi} from '../resources/source-ui-layout';
import {loadUiFont} from '../resources/source-ui-fonts';
import {loadSourceUi} from '../resources/source-ui-resources';

export interface NoticeSnapshot {ui?: HomeSourceUi; message: string; open: boolean;}

/** The waiting-room session owns confirmed rejection text and dismissal. */
export class SourceNotice {
  private state: NoticeSnapshot = {message: '', open: false};
  private readonly listeners = new Set<() => void>();
  private loading?: Promise<HomeSourceUi>;
  private complete?: () => void;
  private generation = 0;
  readonly getSnapshot = (): NoticeSnapshot => this.state;
  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener); return () => {this.listeners.delete(listener);};
  };
  private publish(state: NoticeSnapshot): void {
    this.state = state; for (const listener of this.listeners) listener();
  }
  clear(): void {
    this.generation++;
    const complete = this.complete; this.complete = undefined;
    this.publish({...this.state, message: '', open: false}); complete?.();
  }
  async show(message: string): Promise<void> {
    this.clear();
    const generation = this.generation;
    let ui: HomeSourceUi;
    try {ui = this.state.ui ?? await (this.loading ??= this.load());}
    catch {this.loading = undefined; return;}
    if (generation !== this.generation) return;
    await new Promise<void>(resolve => {
      this.complete = resolve;
      this.publish({ui, message, open: true});
    });
  }
  private async load(): Promise<HomeSourceUi> {
    void loadUiFont().catch(() => {});
    const ui = await loadSourceUi();
    if (!ui.layouts.some(layout => layout.path.endsWith('notify_dialog.xml'))) throw new Error('通知布局缺失');
    return ui;
  }
}
