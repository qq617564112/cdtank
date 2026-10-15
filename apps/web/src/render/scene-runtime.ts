import {ArcRotateCamera,Color3,Color4,HemisphericLight,PassPostProcess,Scene,Texture,Tools,Vector3} from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import {imageResourceUrl} from '../assets/image-cache';
import {installModelImageLoader} from '../assets/model-image-loader';
import {getDisplayPreferences, subscribeDisplayPreferences} from '../interface/settings/display-preferences';
import {isMobileDevice} from '../platform/device';
import {battleUiLayer} from './battle-ui-layer';
import {BattleMotionBlur} from './battle-motion-blur';
import {createWebGpuEngine} from './webgpu-engine';
import {selectEnabledMeshCandidates} from './scene-mesh-candidates';
import {webGpuFrameStats} from './webgpu-frame-stats';
import {SceneShadowLight} from './scene-shadow-light';
import {initializeCartoonOutlineRenderer} from './materials/cartoon-outline-renderer';

/** Babylon owns its frame loop and resources independently of React. */
export async function createSceneRuntime(canvas: HTMLCanvasElement) {
  Tools.PreprocessUrl=imageResourceUrl;
  installModelImageLoader();
  const mobile=isMobileDevice();
  const engine=await createWebGpuEngine(canvas);
  if (mobile) {
    engine.adaptToDeviceRatio=true;
    engine.setHardwareScalingLevel(1/(window.devicePixelRatio || 1));
  }
  const scene=new Scene(engine);
  initializeCartoonOutlineRenderer(scene);
  selectEnabledMeshCandidates(scene);
  const battleUi=battleUiLayer(scene);
  scene.ambientColor=Color3.White();scene.clearColor=new Color4(.25,.36,.44,1);
  const camera=new ArcRotateCamera('camera',-Math.PI/2,Math.PI/3,100,Vector3.Zero(),scene);
  camera.inputs.clear();camera.minZ=.1;camera.maxZ=100000;
  scene.shadowsEnabled=!mobile;
  let worldPass: PassPostProcess | undefined;
  let motionBlur: BattleMotionBlur | undefined;
  let renderScale: number | undefined;
  let msaa4x: boolean | undefined;
  let motionBlurEnabled: boolean | undefined;
  const applyDisplay=(): void=>{
    const preferences=getDisplayPreferences();
    const nextRenderScale=preferences.renderScale;
    const gpuTiming=Boolean(preferences.showFps && engine.getCaps().timerQuery);
    const timingChanged=engine.enableGPUTimingMeasurements !== gpuTiming;
    if (!timingChanged && renderScale === nextRenderScale && msaa4x === preferences.msaa4x
      && motionBlurEnabled === preferences.motionBlur) return;
    engine.enableGPUTimingMeasurements=gpuTiming;
    renderScale=nextRenderScale;msaa4x=preferences.msaa4x;motionBlurEnabled=preferences.motionBlur;
    motionBlur?.dispose();
    motionBlur=undefined;
    worldPass?.dispose(camera);
    worldPass=undefined;
    // Render targets acquire their own GPU counter when they are created.
    // Resolution scales the world camera; the framebuffer follows device pixels.
    // Utility layers draw player labels, minimap and HUD after this pass.
    if (motionBlurEnabled) {
      motionBlur=new BattleMotionBlur(scene,camera,renderScale);
      motionBlur.postProcess.samples=msaa4x ? 4 : 1;
    } else {
      worldPass=new PassPostProcess('battle-world-resolution',renderScale,camera,Texture.BILINEAR_SAMPLINGMODE);
      worldPass.samples=msaa4x ? 4 : 1;
    }
  };
  applyDisplay();
  const unsubscribeDisplay=subscribeDisplayPreferences(applyDisplay);
  const light=new HemisphericLight('sky',new Vector3(0,1,0),scene);
  light.intensity=1.2;light.groundColor=new Color3(.35,.35,.35);
  if (!mobile) new SceneShadowLight(scene);
  const resize=(): void=>{engine.resize();applyDisplay();motionBlur?.resize();};
  window.addEventListener('resize',resize);
  const frameStats=webGpuFrameStats(canvas,scene,engine,()=>motionBlur?.postProcess ?? worldPass);
  engine.runRenderLoop(()=>{
    const startedAt=performance.now();
    frameStats.beginFrame(startedAt);
    const output=motionBlur?.postProcess ?? worldPass;
    const clearWithOutput=scene.postProcessesEnabled && Boolean(output?.isReady());
    engine.setScreenPassDepthEnabled(!clearWithOutput);
    scene.autoClear=!clearWithOutput;
    scene.autoClearDepthAndStencil=!clearWithOutput;
    scene.render();
    const worldFinishedAt=performance.now();
    battleUi.render();frameStats.recordFrame(startedAt,worldFinishedAt);
  });
  return {scene,camera,dispose(): void {
    window.removeEventListener('resize',resize);
    unsubscribeDisplay();
    frameStats.dispose();
    engine.stopRenderLoop();motionBlur?.dispose();scene.dispose();engine.dispose();
  }};
}
