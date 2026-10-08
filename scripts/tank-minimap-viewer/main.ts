import {Camera, Color3, Color4, Engine, FreeCamera, HemisphericLight, Scene, Vector3} from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import {TankView} from '../../apps/web/src/assets/tanks/tank-view';
import type {OwnedTankTextures} from '../../apps/shared/combat/role-owned-textures';

interface MinimapTank {
  id: number;
  name: string;
  textures: OwnedTankTextures;
  hasSeparateTurret: boolean;
}

declare global {
  interface Window {
    tankMinimapViewer: {render(tank: MinimapTank): Promise<string>};
  }
}

const canvas = document.querySelector<HTMLCanvasElement>('#tank-minimap')!;
const engine = new Engine(canvas, true, {alpha: true, preserveDrawingBuffer: true,
  premultipliedAlpha: true}, false);
engine.setHardwareScalingLevel(1);
engine.setSize(2048, 2048);

async function render(tank: MinimapTank): Promise<string> {
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0, 0, 0, 0);
  scene.ambientColor = Color3.White();
  const camera = new FreeCamera('tank-minimap-camera', new Vector3(0, 100, 0), scene);
  camera.upVector = new Vector3(0, 0, 1);
  camera.rotation.set(Math.PI / 2, 0, 0);
  camera.mode = Camera.ORTHOGRAPHIC_CAMERA;
  new HemisphericLight('tank-minimap-light', new Vector3(0, 1, 0), scene).intensity = 1.2;
  let view: TankView | undefined;
  try {
    view = await TankView.loadPreview(scene, `minimap-${tank.id}`, tank.id, tank.textures);
    scene.onBeforeRenderObservable.clear();
    scene.animationsEnabled = false;
    view.advanceAnimations(0);
    if (tank.hasSeparateTurret) {
      const turret = view.root.getChildTransformNodes().find(node => node.name.endsWith('-action-01-turret'));
      if (!turret) throw new Error(`战车 ${tank.id} 缺少独立炮塔模型`);
      turret.scaling.scaleInPlace(1.5);
    } else {
      view.root.scaling.scaleInPlace(1.5);
    }
    let minimum = new Vector3(Infinity, Infinity, Infinity);
    let maximum = new Vector3(-Infinity, -Infinity, -Infinity);
    for (const mesh of view.root.getChildMeshes()) {
      if (!mesh.isEnabled() || !mesh.getTotalVertices()) continue;
      mesh.computeWorldMatrix(true);
      const box = mesh.getBoundingInfo().boundingBox;
      minimum = Vector3.Minimize(minimum, box.minimumWorld);
      maximum = Vector3.Maximize(maximum, box.maximumWorld);
    }
    const half = Math.max(maximum.x - minimum.x, maximum.z - minimum.z) * .56;
    camera.position.set((minimum.x + maximum.x) / 2, maximum.y + half * 4,
      (minimum.z + maximum.z) / 2);
    camera.minZ = .1;
    camera.maxZ = half * 12;
    camera.orthoLeft = camera.orthoBottom = -half;
    camera.orthoRight = camera.orthoTop = half;
    scene.activeCamera = camera;
    scene.render();
    await scene.whenReadyAsync();
    scene.render();
    const output = document.createElement('canvas');
    output.width = output.height = 1024;
    const context = output.getContext('2d')!;
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(canvas, 0, 0, 1024, 1024);
    return output.toDataURL('image/png');
  } finally {
    view?.dispose();
    scene.dispose();
  }
}

window.tankMinimapViewer = {render};
