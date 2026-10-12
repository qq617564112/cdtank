import {ArcRotateCamera, Camera, Color3, Color4, Engine, HemisphericLight,
  Scene, Vector3, VertexBuffer} from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import {TankView} from '../../apps/web/src/assets/tanks/tank-view';
import type {OwnedTankTextures} from '../../apps/shared/combat/role-owned-textures';

interface ThumbnailTank {
  id: number;
  name: string;
  textures: OwnedTankTextures;
}

interface ThumbnailViewer {
  render(tank: ThumbnailTank, size: number, angles: CameraAngles): Promise<string>;
  overview(): Promise<string>;
}

interface CameraAngles {
  azimuth: number;
  elevation: number;
}

declare global {
  interface Window {
    tankThumbnailViewer: ThumbnailViewer;
  }
}

const canvas = document.querySelector<HTMLCanvasElement>('#tank-thumbnail')!;
const engine = new Engine(canvas, true, {alpha: true, preserveDrawingBuffer: true,
  premultipliedAlpha: true}, false);
engine.setHardwareScalingLevel(1);
const rendered = new Map<number, {name: string; png: string}>();

/** Render the complete model from the shared camera angle before cropping. */
function frameTank(scene: Scene, camera: ArcRotateCamera, view: TankView, angles: CameraAngles): void {
  const meshes = view.root.getChildMeshes().filter(mesh => mesh.isEnabled() && mesh.getTotalVertices() > 0);
  if (!meshes.length) throw new Error(`战车 ${view.tankId} 没有可显示的网格`);
  let minimum = new Vector3(Infinity, Infinity, Infinity);
  let maximum = new Vector3(-Infinity, -Infinity, -Infinity);
  for (const mesh of meshes) {
    mesh.computeWorldMatrix(true);
    const positions = mesh.getVerticesData(VertexBuffer.PositionKind)!;
    for (let offset = 0; offset < positions.length; offset += 3) {
      const point = Vector3.TransformCoordinates(Vector3.FromArray(positions, offset), mesh.getWorldMatrix());
      minimum = Vector3.Minimize(minimum, point);
      maximum = Vector3.Maximize(maximum, point);
    }
  }
  const extent = maximum.subtract(minimum);
  camera.target = minimum.add(maximum).scale(0.5);
  camera.alpha = angles.azimuth * Math.PI / 180;
  camera.beta = (90 - angles.elevation) * Math.PI / 180;
  camera.radius = extent.length() * 3;
  camera.minZ = 0.1;
  camera.maxZ = camera.radius * 4;
  const halfSize = extent.length() * 0.6;
  camera.mode = Camera.ORTHOGRAPHIC_CAMERA;
  camera.orthoLeft = -halfSize; camera.orthoRight = halfSize;
  camera.orthoBottom = -halfSize; camera.orthoTop = halfSize;
  scene.activeCamera = camera;
}

/** Trim the transparent background, then fit and center the full silhouette. */
function centeredIcon(size: number): HTMLCanvasElement {
  const source = document.createElement('canvas');
  source.width = canvas.width; source.height = canvas.height;
  const sourceContext = source.getContext('2d')!;
  sourceContext.drawImage(canvas, 0, 0);
  const pixels = sourceContext.getImageData(0, 0, source.width, source.height).data;
  let left = source.width, right = -1, top = source.height, bottom = -1;
  for (let y = 0; y < source.height; y++) {
    for (let x = 0; x < source.width; x++) {
      if (pixels[(y * source.width + x) * 4 + 3] === 0) continue;
      left = Math.min(left, x); right = Math.max(right, x);
      top = Math.min(top, y); bottom = Math.max(bottom, y);
    }
  }
  if (right < left) throw new Error('坦克渲染图为空');
  const width = right - left + 1, height = bottom - top + 1;
  const scale = size * 7 / 8 / Math.max(width, height);
  const output = document.createElement('canvas');
  output.width = size; output.height = size;
  const context = output.getContext('2d')!;
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.fillStyle = '#bd8abd';
  context.fillRect(0, 0, size, size);
  context.drawImage(source, left, top, width, height,
    (size - width * scale) / 2, (size - height * scale) / 2, width * scale, height * scale);
  context.strokeStyle = '#000';
  context.lineWidth = size / 32;
  context.strokeRect(size / 64, size / 64, size * 31 / 32, size * 31 / 32);
  return output;
}

async function render(tank: ThumbnailTank, size: number, angles: CameraAngles): Promise<string> {
  // Render at twice the output size for clean transparent silhouette edges.
  engine.setSize(size * 2, size * 2);
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0, 0, 0, 0);
  scene.ambientColor = Color3.White();
  const camera = new ArcRotateCamera('thumbnail-camera', Math.PI * 3 / 4, Math.PI / 4,
    100, Vector3.Zero(), scene);
  new HemisphericLight('thumbnail-light', new Vector3(0, 1, 0), scene).intensity = 1.2;
  let view: TankView | undefined;
  try {
    view = await TankView.loadPreview(scene, `thumbnail-${tank.id}`, tank.id, tank.textures);
    // Keep every idle model at its first source frame, independent of load time.
    scene.onBeforeRenderObservable.clear();
    scene.animationsEnabled = false;
    view.advanceAnimations(0);
    frameTank(scene, camera, view, angles);
    scene.render();
    await scene.whenReadyAsync();
    scene.render();
    const png = centeredIcon(size).toDataURL('image/png');
    rendered.set(tank.id, {name: tank.name, png});
    return png;
  } finally {
    view?.dispose();
    scene.dispose();
  }
}

async function overview(): Promise<string> {
  const font = new FontFace('thumbnail-label', 'url(/ui/fonts/xiangjiao-brush.ttf)');
  document.fonts.add(await font.load());
  const columns = 7, cellWidth = 180, cellHeight = 186, header = 56;
  const output = document.createElement('canvas');
  output.width = columns * cellWidth;
  output.height = header + Math.ceil(rendered.size / columns) * cellHeight;
  const context = output.getContext('2d')!;
  context.fillStyle = '#f2eadb'; context.fillRect(0, 0, output.width, output.height);
  context.fillStyle = '#302b24'; context.font = '24px thumbnail-label';
  context.fillText('坦克高清图标 · 3D 模型渲染 · 1024 × 1024', 24, 36);
  let index = 0;
  for (const [id, thumbnail] of rendered) {
    const x = index % columns * cellWidth, y = header + Math.floor(index / columns) * cellHeight;
    const picture = new Image(); picture.src = thumbnail.png;
    await picture.decode();
    context.drawImage(picture, x + 14, y + 4, 152, 152);
    context.textAlign = 'center'; context.font = '18px thumbnail-label';
    context.fillStyle = '#302b24'; context.fillText(`${String(id).padStart(3, '0')} ${thumbnail.name}`, x + cellWidth / 2, y + 174);
    index++;
  }
  return output.toDataURL('image/png');
}

window.tankThumbnailViewer = {render, overview};
