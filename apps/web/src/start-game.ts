import {createElement} from 'react';
import type {Root} from 'react-dom/client';
import {Battle} from './match/battle';
import {App} from './app';
import {createSceneRuntime} from './render/scene-runtime';
import {initializeSettings} from './interface/settings/settings-startup';
import {applyDisplayPreferences, readDisplayPreferences} from './interface/settings/display-preferences';
import {prepareBattleArtwork} from './assets/battle-artwork';
import type {ImageLoadingScreen} from './interface/resources/image-loading-screen';

/** Create the scene and page only after startup images are ready. */
export async function startGame(canvas: HTMLCanvasElement, root: Root, signal: AbortSignal,
  onReady: () => void, loadingScreen: ImageLoadingScreen): Promise<() => void> {
  const display = readDisplayPreferences({getItem: key => window.localStorage.getItem(key)});
  applyDisplayPreferences(display.preferences);
  const runtime = await createSceneRuntime(canvas);
  if (signal.aborted) {runtime.dispose(); signal.throwIfAborted();}
  try {
    await prepareBattleArtwork(runtime.scene);
    signal.throwIfAborted();
  } catch (error) {
    runtime.dispose();
    throw error;
  }
  const hud = document.createElement('output');
  hud.id = 'battle-status';
  hud.setAttribute('aria-live', 'polite');
  const battle = new Battle(runtime.scene, runtime.camera, hud);
  if (location.pathname !== '/validation.html') battle.startPageMusic();
  const settings = initializeSettings(battle, display);
  onReady();
  loadingScreen.showGame(createElement(App, {battle, canvas, hud, settings, loadingScreen,
    validation: location.pathname === '/validation.html'}));
  return () => {battle.leave(); root.unmount(); runtime.dispose();};
}
