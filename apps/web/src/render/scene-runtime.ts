import {ArcRotateCamera,Color3,Color4,Engine,HemisphericLight,Scene,Vector3} from '@babylonjs/core';
import '@babylonjs/loaders/glTF';

/** Babylon owns its frame loop and resources independently of React. */
export function createSceneRuntime(canvas: HTMLCanvasElement) {
  const engine=new Engine(canvas,true,{},true),scene=new Scene(engine);
  scene.ambientColor=Color3.White();scene.clearColor=new Color4(.25,.36,.44,1);
  const camera=new ArcRotateCamera('camera',-Math.PI/2,Math.PI/3,100,Vector3.Zero(),scene);
  camera.inputs.clear();camera.minZ=.1;camera.maxZ=100000;
  const light=new HemisphericLight('sky',new Vector3(0,1,0),scene);
  light.intensity=1.2;light.groundColor=new Color3(.35,.35,.35);
  const resize=(): void=>{engine.resize();};
  window.addEventListener('resize',resize);
  engine.runRenderLoop(()=>{scene.render();});
  return {scene,camera,dispose(): void {
    window.removeEventListener('resize',resize);
    engine.stopRenderLoop();scene.dispose();engine.dispose();
  }};
}
