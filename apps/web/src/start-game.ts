import {createElement} from 'react';
import type {Root} from 'react-dom/client';
import {Battle} from './match/battle';
import {App} from './app';
import {createSceneRuntime} from './render/scene-runtime';
import {initializeSettings} from './interface/settings/settings-startup';

/** Create the scene and page only after startup images are ready. */
export function startGame(canvas: HTMLCanvasElement, root: Root): () => void {
  const runtime = createSceneRuntime(canvas);
  const hud = document.createElement('output');
  hud.id = 'battle-status';
  hud.setAttribute('aria-live', 'polite');
  const battle = new Battle(runtime.scene, runtime.camera, hud);
  if (location.pathname !== '/validation.html') battle.startPageMusic();
  const settings = initializeSettings(battle);
  root.render(createElement(App, {battle, canvas, hud, settings, validation: location.pathname === '/validation.html'}));
  return () => {battle.leave(); root.unmount(); runtime.dispose();};
}
