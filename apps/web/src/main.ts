import {createElement} from 'react';
import {createRoot} from 'react-dom/client';
import './style.css';
import {Battle} from './match/battle';
import {App} from './app';
import {createSceneRuntime} from './render/scene-runtime';
import {initializeSettings} from './interface/settings/settings-startup';

const canvas=document.querySelector<HTMLCanvasElement>('#world')!;
const runtime=createSceneRuntime(canvas);
const hud=document.createElement('output');
hud.id='battle-status';hud.setAttribute('aria-live','polite');
const battle=new Battle(runtime.scene,runtime.camera,hud);
if (location.pathname !== '/validation.html') battle.startPageMusic();
const settings=initializeSettings(battle);
const root=createRoot(document.querySelector('#app')!);
root.render(createElement(App,{battle,canvas,hud,settings,validation: location.pathname === '/validation.html'}));
window.addEventListener('pagehide',()=>{
  battle.leave();root.unmount();runtime.dispose();
},{once:true});
