import {ArcRotateCamera,Color3,Color4,HemisphericLight,PassPostProcess,Scene,Texture,Tools,Vector3} from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import {imageResourceUrl} from '../assets/image-cache';
import {installModelImageLoader} from '../assets/model-image-loader';
import {getDisplayPreferences, subscribeDisplayPreferences} from '../interface/settings/display-preferences';
import {battleUiLayer} from './battle-ui-layer';
import {createWebGpuEngine} from './webgpu-engine';
import {selectEnabledMeshCandidates} from './scene-mesh-candidates';
import {webGpuFrameStats} from './webgpu-frame-stats';
import {SceneShadowLight} from './scene-shadow-light';

/** Babylon owns its frame loop and resources independently of React. */
export async function createSceneRuntime(canvas: HTMLCanvasElement) {
  Tools.PreprocessUrl=imageResourceUrl;
  installModelImageLoader();
  const engine=await createWebGpuEngine(canvas),scene=new Scene(engine);
  selectEnabledMeshCandidates(scene);
  const battleUi=battleUiLayer(scene);
  scene.ambientColor=Color3.White();scene.clearColor=new Color4(.25,.36,.44,1);
  const camera=new ArcRotateCamera('camera',-Math.PI/2,Math.PI/3,100,Vector3.Zero(),scene);
  camera.inputs.clear();camera.minZ=.1;camera.maxZ=100000;
  let worldPass: PassPostProcess | undefined;
  let renderScale: number | undefined;
  let msaa4x: boolean | undefined;
  const applyDisplay=(): void=>{
    const preferences=getDisplayPreferences();
    if (renderScale === preferences.renderScale && msaa4x === preferences.msaa4x) return;
    renderScale=preferences.renderScale;msaa4x=preferences.msaa4x;
    worldPass?.dispose(camera);
    // Only the world camera renders at this ratio. The pass restores the native
    // framebuffer before utility layers draw player labels, minimap and HUD.
    worldPass=new PassPostProcess('battle-world-resolution',renderScale,camera,Texture.BILINEAR_SAMPLINGMODE);
    worldPass.samples=msaa4x ? 4 : 1;
  };
  applyDisplay();
  const unsubscribeDisplay=subscribeDisplayPreferences(applyDisplay);
  const light=new HemisphericLight('sky',new Vector3(0,1,0),scene);
  light.intensity=1.2;light.groundColor=new Color3(.35,.35,.35);
  new SceneShadowLight(scene);
  const resize=(): void=>{engine.resize();};
  window.addEventListener('resize',resize);
  const frameStats=webGpuFrameStats(canvas,scene,engine);
  engine.runRenderLoop(()=>{
    const startedAt=performance.now();
    scene.render();battleUi.render();frameStats.recordFrame(startedAt);
  });
  return {scene,camera,dispose(): void {
    window.removeEventListener('resize',resize);
    unsubscribeDisplay();
    frameStats.dispose();
    engine.stopRenderLoop();scene.dispose();engine.dispose();
  }};
}
