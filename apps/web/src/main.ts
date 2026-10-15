import {prepareGameContent} from './content';
import {createRoot} from 'react-dom/client';
import './style.css';
import {pageImages as images, uiSpriteScope} from './assets/preload-images';
import {releaseImageResources} from './assets/image-cache';
import {releaseStaticResources} from './assets/static-resources';
import {ImageLoadingScreen} from './interface/resources/image-loading-screen';
import {battleUiLayouts, prepareSourceUi, STARTUP_UI_LAYOUTS} from './interface/resources/source-ui-resources';
import {prepareSourcePageImages} from './interface/resources/source-page-images';
import {disableTabDefault} from './interface/resources/tab-key-default';
import {reserveFullscreenKeys} from './interface/resources/fullscreen-keys';
import {readGameRoute, reserveBrowserNavigation} from './navigation/route';
import {readRoomSession} from './navigation/session';
import {readQuickStart} from './navigation/quick-start';
import {enforceMobileLandscape} from './platform/mobile-orientation';
import {installGamePageViewport} from './platform/page-viewport';
import {isMobileDevice} from './platform/device';
import {installButtonSound} from './audio/button-sound';
import {readAudioPreferences} from './interface/settings/audio-preferences';
import './interface/mobile/mobile-pages.css';

const restoreButtonSound=installButtonSound(readAudioPreferences(
  {getItem: key=>window.localStorage.getItem(key)}, {music: 0.5, sound: 0.5}).preferences.sound);
const restoreBrowserNavigation=reserveBrowserNavigation();
const restoreMobileLandscape=enforceMobileLandscape();
const restorePageViewport=installGamePageViewport();
const restoreTabDefault=disableTabDefault();
const restoreFullscreenKeys=reserveFullscreenKeys();
const canvas=document.querySelector<HTMLCanvasElement>('#world')!;
const host=document.querySelector('#app')!;
const root=createRoot(host);
canvas.hidden=true;
const battleEntry=['battle','results'].includes(readGameRoute().page);
const controller=new AbortController();
let loading=false;
let moduleImportFailed=false;
let disposeGame: (()=>void) | undefined;
const screen=new ImageLoadingScreen(root,()=>{
  if (moduleImportFailed) window.location.reload();
  else void enterGame();
},battleEntry||readQuickStart()||readRoomSession()?0.1:1);

async function enterGame(): Promise<void> {
  if (loading || controller.signal.aborted) return;
  loading=true;
  moduleImportFailed=false;
  screen.begin();
  // Manifest, loading art, page art, image preload, UI, content, module and scene runtime.
  const totalTasks=8;
  let completedTasks=0;
  let active=true;
  const completeTask=()=>{
    if (active && !controller.signal.aborted) screen.update(++completedTasks/totalTasks);
  };
  try {
    await images.prepare(controller.signal, uiSpriteScope(battleEntry));
    completeTask();
    await Promise.all([
      screen.prepare(controller.signal).then(completeTask),
      prepareSourcePageImages(controller.signal).then(completeTask),
    ]);
    await images.load(progress=>{
      if (!active || controller.signal.aborted) return;
      const fraction=(progress.completed+progress.decoded)/Math.max(1,progress.total+progress.decodeTotal);
      screen.update((completedTasks+fraction)/totalTasks,
        progress.phase==='download'?'正在下载图片…':'正在解码图片…');
    },controller.signal,battleEntry?'battle':'ui');
    completeTask();
    controller.signal.throwIfAborted();
    screen.update(completedTasks/totalTasks,'正在准备游戏内容与界面…');
    await Promise.all([
      prepareSourceUi(battleEntry?battleUiLayouts(isMobileDevice()):STARTUP_UI_LAYOUTS,controller.signal).then(completeTask),
      prepareGameContent().then(completeTask),
    ]);
    const {startGame}=await import('./start-game');
    completeTask();
    if (controller.signal.aborted) return;
    canvas.hidden=false;
    disposeGame=await startGame(canvas,root,controller.signal,completeTask,screen);
  } catch (error) {
    moduleImportFailed=error instanceof TypeError
      && error.message.includes('Failed to fetch dynamically imported module');
    canvas.hidden=true;
    if (!controller.signal.aborted) screen.fail(error);
  } finally {
    active=false;
    loading=false;
  }
}

void enterGame();
window.addEventListener('pagehide',()=>{
  restoreButtonSound();
  restoreBrowserNavigation();
  restoreMobileLandscape();
  restorePageViewport();
  restoreTabDefault();
  restoreFullscreenKeys();
  controller.abort();
  if (disposeGame) disposeGame();
  else root.unmount();
  releaseImageResources();
  releaseStaticResources();
},{once:true});
