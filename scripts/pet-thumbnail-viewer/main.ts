import {ArcRotateCamera, Camera, Color3, Color4, Engine, HemisphericLight, Matrix,
  Scene, Vector3, VertexBuffer} from '@babylonjs/core';
import {PetView} from '../../apps/web/src/assets/pets/pet-view';

interface ThumbnailPet {id: number; name: string;}
interface ThumbnailViewer {
  render(pet: ThumbnailPet, size: number): Promise<string>;
  overview(): Promise<string>;
}

declare global {
  interface Window {petThumbnailViewer: ThumbnailViewer;}
}

const canvas = document.querySelector<HTMLCanvasElement>('#pet-thumbnail')!;
const engine = new Engine(canvas, true, {alpha: true, preserveDrawingBuffer: true,
  premultipliedAlpha: true}, false);
engine.setHardwareScalingLevel(1);
const rendered = new Map<number, {name: string; png: string}>();

/** Frame the forward upper geometry so small avatars retain a readable face. */
function framePet(scene: Scene, camera: ArcRotateCamera, view: PetView): void {
  const meshes = view.root.getChildMeshes().filter(mesh => mesh.isEnabled() && mesh.getTotalVertices() > 0);
  if (!meshes.length) throw new Error(`宠物 ${view.petId} 没有可显示的网格`);
  const points: Vector3[] = [];
  let minimum = new Vector3(Infinity, Infinity, Infinity);
  let maximum = new Vector3(-Infinity, -Infinity, -Infinity);
  for (const mesh of meshes) {
    mesh.computeWorldMatrix(true);
    const positions = mesh.getVerticesData(VertexBuffer.PositionKind)!;
    for (let offset = 0; offset < positions.length; offset += 3) {
      const point = Vector3.TransformCoordinates(Vector3.FromArray(positions, offset), mesh.getWorldMatrix());
      points.push(point);
      minimum = Vector3.Minimize(minimum, point); maximum = Vector3.Maximize(maximum, point);
    }
  }
  const height = maximum.y - minimum.y;
  const portrait = points.filter(point => point.y >= minimum.y + height * 0.40
    && point.z >= (minimum.z + maximum.z) / 2);
  if (!portrait.length) throw new Error(`宠物 ${view.petId} 缺少头像网格`);
  let portraitMin = portrait[0].clone(), portraitMax = portrait[0].clone();
  for (const point of portrait) {
    portraitMin = Vector3.Minimize(portraitMin, point); portraitMax = Vector3.Maximize(portraitMax, point);
  }
  camera.target = portraitMin.add(portraitMax).scale(0.5);
  camera.radius = maximum.subtract(minimum).length() * 3;
  camera.minZ = 0.1; camera.maxZ = camera.radius * 4;
  const matrix = camera.getViewMatrix(true);
  let left = Infinity, right = -Infinity, bottom = Infinity, top = -Infinity;
  for (const point of portrait) {
    const projected = Vector3.TransformCoordinates(point, matrix);
    left = Math.min(left, projected.x); right = Math.max(right, projected.x);
    bottom = Math.min(bottom, projected.y); top = Math.max(top, projected.y);
  }
  camera.target.addInPlace(Vector3.TransformNormal(new Vector3((left + right) / 2, (bottom + top) / 2, 0),
    Matrix.Invert(matrix)));
  const halfSize = Math.max(right - left, top - bottom) * 0.56;
  camera.mode = Camera.ORTHOGRAPHIC_CAMERA;
  camera.orthoLeft = -halfSize; camera.orthoRight = halfSize;
  camera.orthoBottom = -halfSize; camera.orthoTop = halfSize;
  scene.activeCamera = camera;
}

async function render(pet: ThumbnailPet, size: number): Promise<string> {
  engine.setSize(size * 2, size * 2);
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0, 0, 0, 0); scene.ambientColor = Color3.White();
  const camera = new ArcRotateCamera('pet-thumbnail-camera', Math.PI * 3 / 4, Math.PI / 3,
    100, Vector3.Zero(), scene);
  new HemisphericLight('pet-thumbnail-light', new Vector3(0, 1, 0), scene).intensity = 1.2;
  let view: PetView | undefined;
  try {
    view = await PetView.load(scene, pet.id);
    scene.onBeforeRenderObservable.clear(); scene.animationsEnabled = false;
    for (const group of view.assets.animationGroups) group.goToFrame(0);
    framePet(scene, camera, view);
    scene.render(); await scene.whenReadyAsync(); scene.render();
    const output = document.createElement('canvas'); output.width = size; output.height = size;
    const context = output.getContext('2d')!;
    context.imageSmoothingEnabled = true; context.imageSmoothingQuality = 'high';
    context.drawImage(canvas, 0, 0, size, size);
    const png = output.toDataURL('image/png');
    rendered.set(pet.id, {name: pet.name, png});
    return png;
  } finally {
    view?.dispose(); scene.dispose();
  }
}

async function overview(): Promise<string> {
  const font = new FontFace('pet-thumbnail-label', 'url(/ui/fonts/xiangjiao-brush.ttf)');
  document.fonts.add(await font.load());
  const columns = 5, cellWidth = 180, cellHeight = 186, header = 56;
  const output = document.createElement('canvas');
  output.width = columns * cellWidth; output.height = header + Math.ceil(rendered.size / columns) * cellHeight;
  const context = output.getContext('2d')!;
  context.fillStyle = '#f2eadb'; context.fillRect(0, 0, output.width, output.height);
  context.fillStyle = '#302b24'; context.font = '24px pet-thumbnail-label';
  context.fillText('宠物高清头像 · 3D 模型渲染 · 512 × 512', 24, 36);
  let index = 0;
  for (const [id, thumbnail] of rendered) {
    const x = index % columns * cellWidth, y = header + Math.floor(index / columns) * cellHeight;
    const picture = new Image(); picture.src = thumbnail.png; await picture.decode();
    context.drawImage(picture, x + 14, y + 4, 152, 152);
    context.textAlign = 'center'; context.font = '18px pet-thumbnail-label';
    context.fillStyle = '#302b24';
    context.fillText(`${String(id).padStart(3, '0')} ${thumbnail.name}`, x + cellWidth / 2, y + 174);
    index++;
  }
  return output.toDataURL('image/png');
}

window.petThumbnailViewer = {render, overview};
