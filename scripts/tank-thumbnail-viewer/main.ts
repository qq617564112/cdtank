import {ArcRotateCamera, Camera, Color3, Color4, Engine, HemisphericLight, Matrix,
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
  render(tank: ThumbnailTank, size: number): Promise<string>;
  overview(): Promise<string>;
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

/** Fit the projected geometry at a fixed front-quarter view, without perspective distortion. */
function frameTank(scene: Scene, camera: ArcRotateCamera, view: TankView): void {
  const meshes = view.root.getChildMeshes().filter(mesh => mesh.isEnabled() && mesh.getTotalVertices() > 0);
  if (!meshes.length) throw new Error(`战车 ${view.tankId} 没有可显示的网格`);
  let minimum = new Vector3(Infinity, Infinity, Infinity);
  let maximum = new Vector3(-Infinity, -Infinity, -Infinity);
  for (const mesh of meshes) {
    mesh.computeWorldMatrix(true);
    const box = mesh.getBoundingInfo().boundingBox;
    minimum = Vector3.Minimize(minimum, box.minimumWorld);
    maximum = Vector3.Maximize(maximum, box.maximumWorld);
  }
  camera.target = minimum.add(maximum).scale(0.5);
  camera.radius = maximum.subtract(minimum).length() * 3;
  camera.minZ = 0.1;
  camera.maxZ = camera.radius * 4;
  const viewMatrix = camera.getViewMatrix(true);
  let left = Infinity, right = -Infinity, bottom = Infinity, top = -Infinity;
  for (const mesh of meshes) {
    const positions = mesh.getVerticesData(VertexBuffer.PositionKind)!;
    const worldView = mesh.getWorldMatrix().multiply(viewMatrix);
    for (let offset = 0; offset < positions.length; offset += 3) {
      const point = Vector3.TransformCoordinates(Vector3.FromArray(positions, offset), worldView);
      left = Math.min(left, point.x); right = Math.max(right, point.x);
      bottom = Math.min(bottom, point.y); top = Math.max(top, point.y);
    }
  }
  const center = Vector3.TransformNormal(new Vector3((left + right) / 2, (bottom + top) / 2, 0),
    Matrix.Invert(viewMatrix));
  camera.target.addInPlace(center);
  const halfSize = Math.max(right - left, top - bottom) * 0.56;
  camera.mode = Camera.ORTHOGRAPHIC_CAMERA;
  camera.orthoLeft = -halfSize; camera.orthoRight = halfSize;
  camera.orthoBottom = -halfSize; camera.orthoTop = halfSize;
  scene.activeCamera = camera;
}

async function render(tank: ThumbnailTank, size: number): Promise<string> {
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
    frameTank(scene, camera, view);
    scene.render();
    await scene.whenReadyAsync();
    scene.render();
    const output = document.createElement('canvas');
    output.width = size; output.height = size;
    const context = output.getContext('2d')!;
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(canvas, 0, 0, size, size);
    const png = output.toDataURL('image/png');
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
  context.fillText('战车高清缩略图 · 45° 俯视 · 512 × 512', 24, 36);
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
