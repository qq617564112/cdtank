import {ArcRotateCamera,Color3,Color4,FxaaPostProcess,HemisphericLight,PassPostProcess,PostProcess,Scene,Texture,Tools,Vector3} from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
// FXAA loads its WGSL on demand; bundling it avoids a blank world on the first toggle.
import '@babylonjs/core/ShadersWGSL/fxaa.fragment';
import '@babylonjs/core/ShadersWGSL/fxaa.vertex';
import {imageResourceUrl} from '../assets/image-cache';
import {installModelImageLoader} from '../assets/model-image-loader';
import {getDisplayPreferences, subscribeDisplayPreferences} from '../interface/settings/display-preferences';
import {isMobileDevice} from '../platform/device';
import {battleUiLayer} from './battle-ui-layer';
import {BattleMotionBlur} from './battle-motion-blur';
import {DynamicResolution, registerDynamicResolution} from './dynamic-resolution';
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
  // FXAA smooths the world after post-processing; screen layers draw without MSAA.
  const engine=await createWebGpuEngine(canvas,false,false);
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
  let passes: PostProcess[]=[];
  let motionBlur: BattleMotionBlur | undefined;
  let renderScale=1;
  let antialias: boolean | undefined;
  let motionBlurEnabled: boolean | undefined;
  const resolution=new DynamicResolution();
  registerDynamicResolution(scene,resolution);
  // Babylon reallocates a post-process target on its next activation after the ratio changes.
  const applyResolution=(): void=>{
    for (const pass of passes) (pass as unknown as {_options: number})._options=renderScale*resolution.factor;
  };
  const applyDisplay=(): void=>{
    const preferences=getDisplayPreferences();
    const gpuTiming=Boolean(preferences.showFps && engine.getCaps().timerQuery);
    const timingChanged=engine.enableGPUTimingMeasurements !== gpuTiming;
    if (!timingChanged && renderScale === preferences.renderScale && antialias === preferences.antialias
      && motionBlurEnabled === preferences.motionBlur) return;
    engine.enableGPUTimingMeasurements=gpuTiming;
    renderScale=preferences.renderScale;antialias=preferences.antialias;motionBlurEnabled=preferences.motionBlur;
    for (const pass of passes) if (pass !== motionBlur?.postProcess) pass.dispose(camera);
    motionBlur?.dispose();
    motionBlur=undefined;
    passes=[];
    // Render targets acquire their own GPU counter when they are created.
    // Resolution scales the world camera; the framebuffer follows device pixels.
    // The first pass receives the scene; utility layers draw labels, minimap and HUD after the last.
    if (motionBlurEnabled) {
      motionBlur=new BattleMotionBlur(scene,camera,renderScale);
      passes.push(motionBlur.postProcess);
    }
    if (antialias) passes.push(new FxaaPostProcess('battle-world-antialias',renderScale,camera,Texture.BILINEAR_SAMPLINGMODE));
    if (!passes.length) passes.push(new PassPostProcess('battle-world-resolution',renderScale,camera,Texture.BILINEAR_SAMPLINGMODE));
    applyResolution();
  };
  applyDisplay();
  const unsubscribeDisplay=subscribeDisplayPreferences(applyDisplay);
  const light=new HemisphericLight('sky',new Vector3(0,1,0),scene);
  light.intensity=1.2;light.groundColor=new Color3(.35,.35,.35);
  if (!mobile) new SceneShadowLight(scene);
  const resize=(): void=>{engine.resize();applyDisplay();motionBlur?.resize();};
  window.addEventListener('resize',resize);
  const frameStats=webGpuFrameStats(canvas,scene,engine,()=>passes[0],()=>renderScale*resolution.factor);
  engine.runRenderLoop(()=>{
    const startedAt=performance.now();
    frameStats.beginFrame(startedAt);
    const clearWithOutput=scene.postProcessesEnabled && passes.every(pass=>pass.isReady());
    engine.setScreenPassDepthEnabled(!clearWithOutput);
    scene.autoClear=!clearWithOutput;
    scene.autoClearDepthAndStencil=!clearWithOutput;
    scene.render();
    const worldFinishedAt=performance.now();
    battleUi.render();frameStats.recordFrame(startedAt,worldFinishedAt);
    if (resolution.record(startedAt,performance.now()-startedAt)) applyResolution();
  });
  return {scene,camera,dispose(): void {
    window.removeEventListener('resize',resize);
    unsubscribeDisplay();
    frameStats.dispose();
    engine.stopRenderLoop();motionBlur?.dispose();scene.dispose();engine.dispose();
  }};
}
