import {ArcRotateCamera, AssetContainer, Color3, Color4, Engine, LoadAssetContainerAsync,
  PBRMaterial, Scene, Vector3} from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import './tank-audit.css';
import {loadStaticJson} from '../../apps/web/src/assets/static-resources';

interface ModelState {
  action: string;
  variant: string;
  original: string;
  api4k: string;
}

interface ObjectEntry {
  model: string;
  maps: string[];
  textureCount: number;
  models: ModelState[];
}

interface Catalog {
  mapCount: number;
  expectedGroups: number;
  reviewedGroups: number;
  objects: ObjectEntry[];
}

const canvas = document.querySelector<HTMLCanvasElement>('#world')!;
const mapSelect = document.querySelector<HTMLSelectElement>('#map')!;
const objectSelect = document.querySelector<HTMLSelectElement>('#object')!;
const stateSelect = document.querySelector<HTMLSelectElement>('#state')!;
const qualitySelect = document.querySelector<HTMLSelectElement>('#quality')!;
const status = document.querySelector<HTMLOutputElement>('#status')!;
const retry = document.querySelector<HTMLButtonElement>('#retry')!;
const controls = [...document.querySelectorAll<HTMLFieldSetElement>('fieldset')];
const engine = new Engine(canvas, true, {preserveDrawingBuffer: true}, false);
const scene = new Scene(engine);
scene.clearColor = new Color4(.09, .11, .13, 1);
scene.ambientColor = Color3.White();
const camera = new ArcRotateCamera('object-camera', -Math.PI / 2, Math.PI / 3,
  100, Vector3.Zero(), scene);
camera.minZ = .01;
camera.lowerBetaLimit = .01;
camera.upperBetaLimit = Math.PI - .01;
camera.attachControl(canvas, true);
let catalog: Catalog;
let objects: ObjectEntry[] = [];
let container: AssetContainer | undefined;
let fittedRadius = 100;
const fittedTarget = Vector3.Zero();
let loading = false;

const views: Readonly<Record<string, readonly [number, number]>> = {
  center: [-Math.PI / 2, Math.PI / 3], top: [-Math.PI / 2, .01],
  front: [Math.PI / 2, Math.PI / 2 - .1], rear: [-Math.PI / 2, Math.PI / 2 - .1],
  left: [0, Math.PI / 2 - .1], right: [Math.PI, Math.PI / 2 - .1],
};

function setView(name: string): void {
  const [alpha, beta] = views[name];
  camera.alpha = alpha;
  camera.beta = beta;
  camera.radius = fittedRadius;
  camera.target.copyFrom(fittedTarget);
}

function selectObject(): void {
  const entry = objects.find(row => row.model === objectSelect.value)!;
  stateSelect.replaceChildren(...entry.models.map((row, index) =>
    new Option(`${row.action} · ${row.variant}`, String(index))));
}

function selectMap(): void {
  objects = catalog.objects.filter(row => row.maps.includes(mapSelect.value));
  objectSelect.replaceChildren(...objects.map(row => new Option(row.model, row.model)));
  selectObject();
}

async function loadModel(preserveCamera = false): Promise<void> {
  if (loading) return;
  loading = true;
  controls.forEach(control => {control.disabled = true;});
  retry.hidden = true;
  status.value = '载入模型与贴图…';
  const entry = objects.find(row => row.model === objectSelect.value)!;
  const state = entry.models[Number(stateSelect.value)];
  const quality = qualitySelect.value === 'original' ? 'original' : 'api4k';
  try {
    const next = await LoadAssetContainerAsync(state[quality], scene,
      {pluginOptions: {gltf: {
        useSRGBBuffers: false,
        preprocessUrlAsync: async url => new URL(url, location.href).href,
      }}});
    container?.dispose();
    container = next;
    container.addAllToScene();
    container.animationGroups.forEach(group => {group.stop(); group.reset();});
    container.materials.forEach(material => {
      if (material instanceof PBRMaterial) material.unlit = true;
    });
    let minimum = new Vector3(Infinity, Infinity, Infinity);
    let maximum = new Vector3(-Infinity, -Infinity, -Infinity);
    for (const mesh of container.meshes.filter(mesh => mesh.getTotalVertices() > 0)) {
      mesh.computeWorldMatrix(true);
      const bounds = mesh.getBoundingInfo().boundingBox;
      minimum = Vector3.Minimize(minimum, bounds.minimumWorld);
      maximum = Vector3.Maximize(maximum, bounds.maximumWorld);
    }
    fittedTarget.copyFrom(maximum.add(minimum).scale(.5));
    fittedRadius = Math.max(maximum.subtract(minimum).length() * 1.15, .1);
    camera.maxZ = Math.max(1000, fittedRadius * 100);
    camera.lowerRadiusLimit = fittedRadius / 100;
    camera.upperRadiusLimit = fittedRadius * 5;
    camera.wheelPrecision = 100 / fittedRadius;
    camera.panningSensibility = 10000 / fittedRadius;
    if (!preserveCamera) setView('center');
    scene.render();
    await scene.whenReadyAsync();
    document.querySelector('#object-title')!.textContent = entry.model;
    document.querySelector('#object-detail')!.textContent =
      `${quality === 'original' ? '原版' : '4K'} · ${state.action} · ${entry.textureCount} 张贴图`;
    status.value = `${mapSelect.value} · ${entry.models.length} 个模型状态`;
    const url = new URL(location.href);
    url.searchParams.set('map', mapSelect.value);
    url.searchParams.set('object', entry.model);
    url.searchParams.set('state', stateSelect.value);
    url.searchParams.set('quality', quality);
    history.replaceState(null, '', url);
  } catch (error) {
    showError(error);
  } finally {
    loading = false;
    controls.forEach(control => {control.disabled = false;});
  }
}

async function initialize(): Promise<void> {
  catalog = await loadStaticJson<Catalog>('/map-audit/manifest.json');
  const maps = [...new Set(catalog.objects.flatMap(row => row.maps))].sort();
  if (!maps.length) throw new Error('暂无完成复审的物件');
  mapSelect.replaceChildren(...maps.map(id => new Option(`地图 ${id}`, id)));
  const requested = new URL(location.href).searchParams;
  const map = requested.get('map');
  if (map && maps.includes(map)) mapSelect.value = map;
  selectMap();
  const object = requested.get('object');
  if (objects.some(row => row.model === object)) {
    objectSelect.value = object!;
    selectObject();
  }
  const state = Number(requested.get('state') || '0');
  if (Number.isInteger(state) && state >= 0 && state < stateSelect.options.length) {
    stateSelect.value = String(state);
  }
  qualitySelect.value = requested.get('quality') === 'original' ? 'original' : 'api4k';
  document.querySelector('#coverage')!.textContent =
    `${catalog.mapCount} 张地图 · ${catalog.reviewedGroups}/${catalog.expectedGroups} 组物件`;
  await loadModel();
}

function showError(error: unknown): void {
  status.value = `载入失败：${error instanceof Error ? error.message : String(error)}`;
  retry.hidden = false;
}

mapSelect.addEventListener('change', () => {selectMap(); void loadModel();});
objectSelect.addEventListener('change', () => {selectObject(); void loadModel();});
stateSelect.addEventListener('change', () => {void loadModel();});
qualitySelect.addEventListener('change', () => {void loadModel(true);});
for (const [id, delta] of [['previous', -1], ['next', 1]] as const) {
  document.querySelector(`#${id}`)!.addEventListener('click', () => {
    objectSelect.selectedIndex = (objectSelect.selectedIndex + delta + objects.length) % objects.length;
    selectObject();
    void loadModel();
  });
}
document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(button => {
  button.addEventListener('click', () => {setView(button.dataset.view!);});
});
retry.addEventListener('click', () => {void initialize().catch(showError);});
new ResizeObserver(() => {engine.resize();}).observe(canvas);
engine.runRenderLoop(() => {if (!loading) scene.render();});
void initialize().catch(showError);
