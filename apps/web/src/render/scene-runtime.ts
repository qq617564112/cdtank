import {ArcRotateCamera,Color3,Color4,Engine,HemisphericLight,Scene,Tools,Vector3} from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import {imageResourceUrl} from '../assets/image-cache';
import {getDisplayPreferences, subscribeDisplayPreferences} from '../interface/settings/display-preferences';
import {battleUiLayer} from './battle-ui-layer';

/** Babylon owns its frame loop and resources independently of React. */
export function createSceneRuntime(canvas: HTMLCanvasElement) {
  Tools.PreprocessUrl=imageResourceUrl;
  const engine=new Engine(canvas,true,{},true),scene=new Scene(engine);
  const battleUi=battleUiLayer(scene);
  const displayScale=(): number => (getDisplayPreferences().highPrecision ? 1 : 2)
    / (window.devicePixelRatio || 1);
  const applyDisplayScale=(): void=>{engine.setHardwareScalingLevel(displayScale());};
  const applyDisplay=(): void=>{applyDisplayScale();};
  const unsubscribeDisplay=subscribeDisplayPreferences(applyDisplay);
  applyDisplayScale();
  scene.ambientColor=Color3.White();scene.clearColor=new Color4(.25,.36,.44,1);
  const camera=new ArcRotateCamera('camera',-Math.PI/2,Math.PI/3,100,Vector3.Zero(),scene);
  camera.inputs.clear();camera.minZ=.1;camera.maxZ=100000;
  const light=new HemisphericLight('sky',new Vector3(0,1,0),scene);
  light.intensity=1.2;light.groundColor=new Color3(.35,.35,.35);
  const resize=(): void=>{
    engine.resize();
    const scale=displayScale();
    if (engine.getHardwareScalingLevel() !== scale) engine.setHardwareScalingLevel(scale);
  };
  window.addEventListener('resize',resize);
  engine.runRenderLoop(()=>{scene.render();battleUi.render();});
  return {scene,camera,dispose(): void {
    window.removeEventListener('resize',resize);
    unsubscribeDisplay();
    engine.stopRenderLoop();scene.dispose();engine.dispose();
  }};
}
