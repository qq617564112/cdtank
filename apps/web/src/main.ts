import {prepareGameContent} from './content';
import {createRoot} from 'react-dom/client';
import './style.css';
import {ImagePreloader} from './assets/preload-images';
import {releaseImageResources} from './assets/image-cache';
import {ImageLoadingScreen} from './interface/resources/image-loading-screen';
import {prepareSourceUi, STARTUP_UI_LAYOUTS} from './interface/resources/source-ui-resources';
import {prepareSourcePageImages} from './interface/resources/source-page-images';
import {disableTabDefault} from './interface/resources/tab-key-default';
import {reserveFullscreenKeys} from './interface/resources/fullscreen-keys';

const restoreTabDefault=disableTabDefault();
const restoreFullscreenKeys=reserveFullscreenKeys();
const canvas=document.querySelector<HTMLCanvasElement>('#world')!;
const host=document.querySelector('#app')!;
const root=createRoot(host);
canvas.hidden=true;
const images=new ImagePreloader();
const controller=new AbortController();
let loading=false;
let disposeGame: (()=>void) | undefined;
const screen=new ImageLoadingScreen(root,()=>{void enterGame();});

async function enterGame(): Promise<void> {
  if (loading || controller.signal.aborted) return;
  loading=true;
  screen.begin();
  try {
    await images.prepare(controller.signal);
    await Promise.all([screen.prepare(controller.signal), prepareSourcePageImages(controller.signal)]);
    await images.load(progress=>screen.update(progress),controller.signal);
    controller.signal.throwIfAborted();
    screen.preparingContentAndUi();
    await Promise.all([prepareSourceUi(STARTUP_UI_LAYOUTS), prepareGameContent()]);
    const {startGame}=await import('./start-game');
    if (controller.signal.aborted) return;
    canvas.hidden=false;
    disposeGame=startGame(canvas,root);
  } catch (error) {
    canvas.hidden=true;
    if (!controller.signal.aborted) screen.fail(error);
  } finally {
    loading=false;
  }
}

void enterGame();
window.addEventListener('pagehide',()=>{
  restoreTabDefault();
  restoreFullscreenKeys();
  controller.abort();
  if (disposeGame) disposeGame();
  else root.unmount();
  releaseImageResources();
},{once:true});
