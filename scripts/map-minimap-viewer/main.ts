import {ArcRotateCamera, Color3, Color4, Engine, HemisphericLight, Scene, Vector3} from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import {ScenePreview} from '../../apps/web/src/assets/scenes/scene-preview';
import {BattleMinimap} from '../../apps/web/src/render/battle-minimap';
import {EffectRuntime} from '../../apps/web/src/render/effects/runtime/effect-runtime';
import {hudMinimapBounds} from '../../apps/web/src/interface/battle/hud-minimap-bounds';

interface MapMinimapViewer {
  render(id: string): Promise<{png: string; meshes: number}>;
  overview(): Promise<string>;
}

declare global {
  interface Window {
    mapMinimapViewer: MapMinimapViewer;
  }
}

const canvas = document.querySelector<HTMLCanvasElement>('#map-minimap')!;
const engine = new Engine(canvas, true, {preserveDrawingBuffer: true}, false);
engine.setHardwareScalingLevel(1);
engine.setSize(1024, 1024);
const rendered = new Map<string, string>();
const ceilings: Readonly<Record<string, string>> = {
  '0009': 'plane02/1',
  '0015': 'plane01/23',
  '0018': 'plane01/19',
};

async function render(id: string): Promise<{png: string; meshes: number}> {
  if (!hudMinimapBounds(Number(id))) throw new Error(`地图 ${id} 缺少雷达坐标范围`);
  const scene = new Scene(engine);
  scene.ambientColor = Color3.White();
  scene.clearColor = new Color4(.25, .36, .44, 1);
  const camera = new ArcRotateCamera('map-preview', -Math.PI / 2, Math.PI / 3,
    100, Vector3.Zero(), scene);
  camera.minZ = .1;
  camera.maxZ = 100000;
  const light = new HemisphericLight('sky', new Vector3(0, 1, 0), scene);
  light.intensity = 1.2;
  light.groundColor = new Color3(.35, .35, .35);
  const preview = new ScenePreview(scene, camera);
  const effects = new EffectRuntime(scene, camera);
  const capture = new BattleMinimap(scene);
  try {
    // Supplying the battle runtime selects authentic intact castle actions.
    await preview.load(id, effects);
    scene.animationsEnabled = false;
    // Indoor terrain includes a roof above the entire playfield. Omit that
    // source primitive so the radar shows the floor and its real 3D objects.
    const meshes = preview.minimapMeshes.filter(mesh => mesh.isEnabled() && mesh.getTotalVertices() > 0
      && mesh.name !== ceilings[id]);
    if (!meshes.length) throw new Error(`地图 ${id} 没有可渲染的网格`);
    scene.render();
    await scene.whenReadyAsync();
    const pending = capture.capture(Number(id), meshes);
    engine.runRenderLoop(() => {scene.render();});
    const png = await pending;
    if (!png) throw new Error(`地图 ${id} 俯视图捕获失败`);
    rendered.set(id, png);
    return {png, meshes: meshes.length};
  } finally {
    engine.stopRenderLoop();
    capture.clear();
    preview.clear();
    scene.dispose();
  }
}

async function overview(): Promise<string> {
  const columns = 6, cell = 208, header = 48;
  const output = document.createElement('canvas');
  output.width = columns * cell;
  output.height = header + Math.ceil(rendered.size / columns) * (cell + 24);
  const context = output.getContext('2d')!;
  context.fillStyle = '#171d22';
  context.fillRect(0, 0, output.width, output.height);
  context.fillStyle = '#edf2f4';
  context.font = '20px sans-serif';
  context.fillText('3D MAP MINIMAPS | 1024 x 1024 | +X right / +Z up', 16, 30);
  let index = 0;
  for (const [id, png] of rendered) {
    const x = index % columns * cell, y = header + Math.floor(index / columns) * (cell + 24);
    const image = new Image();
    image.src = png;
    await image.decode();
    context.drawImage(image, x + 8, y + 4, 192, 192);
    context.textAlign = 'center';
    context.font = '16px sans-serif';
    context.fillText(id, x + cell / 2, y + 218);
    index++;
  }
  return output.toDataURL('image/png');
}

window.mapMinimapViewer = {render, overview};
