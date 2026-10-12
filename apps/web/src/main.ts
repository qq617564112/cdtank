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
  // Manifest, loading art, page art, UI, content, module and scene runtime.
  const totalTasks=7;
  let completedTasks=0;
  let active=true;
  const completeTask=()=>{
    if (active && !controller.signal.aborted) screen.update(++completedTasks/totalTasks);
  };
  try {
    await images.prepare(controller.signal);
    completeTask();
    await Promise.all([
      screen.prepare(controller.signal).then(completeTask),
      prepareSourcePageImages(controller.signal).then(completeTask),
    ]);
    controller.signal.throwIfAborted();
    screen.update(completedTasks/totalTasks,'正在准备游戏内容与界面…');
    await Promise.all([
      prepareSourceUi(STARTUP_UI_LAYOUTS).then(completeTask),
      prepareGameContent().then(completeTask),
    ]);
    const {startGame}=await import('./start-game');
    completeTask();
    if (controller.signal.aborted) return;
    canvas.hidden=false;
    disposeGame=await startGame(canvas,root,controller.signal,completeTask);
  } catch (error) {
    canvas.hidden=true;
    if (!controller.signal.aborted) screen.fail(error);
  } finally {
    active=false;
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
