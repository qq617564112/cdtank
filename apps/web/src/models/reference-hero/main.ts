import {ArcRotateCamera, Camera, Color3, Color4, CubeTexture, DirectionalLight,
  Engine, HemisphericLight, Scene, SceneSerializer,
  Vector3} from '@babylonjs/core';
import {createReferenceHero} from './model';
import {imageResourceUrl, releaseImageResources} from '../../assets/image-cache';
import {decodeImage} from '../../assets/image-resources';
import {ImagePreloader} from '../../assets/preload-images';
import './viewer.css';

type ViewName = 'front' | 'right' | 'back' | 'top';

interface ReferenceView {
  readonly alpha: number;
  readonly beta: number;
  readonly label: string;
}

const VIEWS: Record<ViewName, ReferenceView> = {
  front: {alpha: -Math.PI / 2, beta: Math.PI / 2, label: '正面 / FRONT'},
  right: {alpha: 0, beta: Math.PI / 2, label: '右侧 / RIGHT'},
  back: {alpha: Math.PI / 2, beta: Math.PI / 2, label: '背面 / BACK'},
  top: {alpha: -Math.PI / 4, beta: Math.PI / 4, label: '45° 俯视 / TOP'},
};

const imageController = new AbortController();
const referenceUrl = new URL('../../../../../nanobanana-preview-original-2026-10-07T03-03-04-732Z.png', import.meta.url).href;
const environmentUrl = new URL('./studio.envmap', import.meta.url).href;
const canvas = document.querySelector<HTMLCanvasElement>('#hero-canvas')!;
const stage = document.querySelector<HTMLElement>('.stage')!;
const loading = document.querySelector<HTMLElement>('#loading')!;
const renderStatus = document.querySelector<HTMLElement>('#render-status')!;
const viewLabel = document.querySelector<HTMLElement>('#view-name')!;
const rotationButton = document.querySelector<HTMLButtonElement>('#auto-rotate')!;
const exportButton = document.querySelector<HTMLButtonElement>('#export-model')!;
const referenceDialog = document.querySelector<HTMLDialogElement>('#reference-dialog')!;

document.querySelector('#open-reference')!.addEventListener('click', () => referenceDialog.showModal());
document.querySelector('#close-reference')!.addEventListener('click', () => referenceDialog.close());
referenceDialog.addEventListener('click', event => {
  if (event.target === referenceDialog) referenceDialog.close();
});

function download(data: Blob | string, filename: string): void {
  const href = typeof data === 'string' ? data : URL.createObjectURL(data);
  const link = document.createElement('a');
  link.href = href;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  if (typeof data !== 'string') {
    window.setTimeout(() => URL.revokeObjectURL(href), 1000);
  }
}

async function start(): Promise<void> {
  await new ImagePreloader().prepare(imageController.signal);
  await decodeImage(referenceUrl, imageController.signal);
  for (const image of document.querySelectorAll<HTMLImageElement>('#reference-image, #large-reference-image')) {
    image.src = imageResourceUrl(referenceUrl);
  }
  await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  const engine = new Engine(canvas, true, {preserveDrawingBuffer: true, stencil: true});
  engine.setHardwareScalingLevel(1 / Math.min(window.devicePixelRatio, 2));
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.98, 0.98, 0.985, 1);
  scene.environmentTexture = CubeTexture.CreateFromPrefilteredData(environmentUrl, scene, '.env');
  scene.environmentIntensity = 0.55;
  scene.imageProcessingConfiguration.exposure = 1;
  scene.imageProcessingConfiguration.contrast = 1;

  const camera = new ArcRotateCamera('reference-camera', VIEWS.front.alpha, VIEWS.front.beta,
    5, new Vector3(0, 1.025, 0), scene);
  camera.mode = Camera.ORTHOGRAPHIC_CAMERA;
  camera.minZ = 0.01;
  camera.maxZ = 30;
  camera.lowerBetaLimit = 0.08;
  camera.upperBetaLimit = Math.PI - 0.08;
  camera.lowerRadiusLimit = 5;
  camera.upperRadiusLimit = 5;
  camera.panningSensibility = 0;
  camera.angularSensibilityX = 850;
  camera.angularSensibilityY = 850;
  camera.inertia = 0.72;
  camera.attachControl(canvas, true);
  camera.inputs.removeByType('ArcRotateCameraMouseWheelInput');
  camera.inputs.removeByType('ArcRotateCameraKeyboardMoveInput');

  const fill = new HemisphericLight('soft-studio-fill', new Vector3(0, 1, -0.35), scene);
  fill.intensity = 0.80;
  fill.groundColor = Color3.FromHexString('#b5bac7');
  const key = new DirectionalLight('large-key-light', new Vector3(1.4, -2.6, 2.3), scene);
  key.position = new Vector3(-2.4, 4.5, -3.5);
  key.intensity = 1.4;
  const rim = new DirectionalLight('rear-softbox', new Vector3(-1, -1.4, -1.2), scene);
  rim.position = new Vector3(2, 3, 2);
  rim.intensity = 0.30;
  rim.diffuse = Color3.FromHexString('#e5edff');

  const hero = await createReferenceHero(scene);

  const triangleCount = hero.meshes.reduce((count, mesh) => count + mesh.getTotalIndices() / 3, 0);
  document.querySelector('#mesh-stats')!.textContent =
    `T-POSE · ${(triangleCount / 1000).toFixed(1)}K TRIANGLES`;
  let activeView: ViewName = 'front';
  let zoom = 1;
  let rotating = false;

  function frame(): void {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const aspect = width / height;
    const halfHeight = Math.max(1.04 * height / (height - 148), 1.12 / aspect) * zoom;
    camera.orthoLeft = -halfHeight * aspect;
    camera.orthoRight = halfHeight * aspect;
    camera.orthoTop = halfHeight;
    camera.orthoBottom = -halfHeight;
    camera.target.y = 1 - 28 * halfHeight / height;
  }

  function setRotating(value: boolean): void {
    rotating = value;
    rotationButton.setAttribute('aria-pressed', String(value));
    if (value) showFreeView();
  }

  function showFreeView(): void {
    viewLabel.textContent = '自由视角 / ORBIT';
    for (const button of document.querySelectorAll<HTMLButtonElement>('[data-view]')) {
      button.setAttribute('aria-pressed', 'false');
    }
  }

  function setView(name: ViewName): void {
    const view = VIEWS[name];
    activeView = name;
    setRotating(false);
    camera.alpha = view.alpha;
    camera.beta = view.beta;
    camera.inertialAlphaOffset = 0;
    camera.inertialBetaOffset = 0;
    zoom = 1;
    frame();
    viewLabel.textContent = view.label;
    for (const button of document.querySelectorAll<HTMLButtonElement>('[data-view]')) {
      button.setAttribute('aria-pressed', String(button.dataset.view === name));
    }
  }

  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-view]')) {
    button.addEventListener('click', () => setView(button.dataset.view as ViewName));
  }
  rotationButton.addEventListener('click', () => setRotating(!rotating));
  document.querySelector('#reset-view')!.addEventListener('click', () => setView(activeView));
  canvas.addEventListener('wheel', event => {
    event.preventDefault();
    zoom = Math.max(0.35, Math.min(2.4, zoom * Math.exp(event.deltaY * 0.001)));
    frame();
  }, {passive: false});

  const pointers = new Map<number, {x: number; y: number}>();
  let pinchDistance: number | undefined;
  let moved = false;
  canvas.addEventListener('pointerdown', event => {
    pointers.set(event.pointerId, {x: event.clientX, y: event.clientY});
    setRotating(false);
    moved = false;
  });
  canvas.addEventListener('pointermove', event => {
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, {x: event.clientX, y: event.clientY});
    if (!moved && (event.movementX !== 0 || event.movementY !== 0)) {
      showFreeView();
      moved = true;
    }
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchDistance !== undefined && distance > 0) {
        zoom = Math.max(0.35, Math.min(2.4, zoom * pinchDistance / distance));
        frame();
      }
      pinchDistance = distance;
    }
  });
  const endPointer = (event: PointerEvent): void => {
    pointers.delete(event.pointerId);
    pinchDistance = undefined;
  };
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('lostpointercapture', endPointer);
  canvas.addEventListener('keydown', event => {
    const keys: Record<string, ViewName> = {1: 'front', 2: 'right', 3: 'back', 4: 'top'};
    if (keys[event.key]) {
      event.preventDefault();
      setView(keys[event.key]);
    } else if (event.key.toLowerCase() === 'r') {
      setView(activeView);
    }
  });

  const wireframeButton = document.querySelector<HTMLButtonElement>('#wireframe')!;
  wireframeButton.addEventListener('click', () => {
    const enabled = wireframeButton.getAttribute('aria-pressed') !== 'true';
    wireframeButton.setAttribute('aria-pressed', String(enabled));
    for (const material of new Set(hero.meshes.map(mesh => mesh.material))) {
      if (material) material.wireframe = enabled;
    }
  });
  const backgroundButton = document.querySelector<HTMLButtonElement>('#background')!;
  backgroundButton.addEventListener('click', () => {
    const dark = backgroundButton.getAttribute('aria-pressed') !== 'true';
    backgroundButton.setAttribute('aria-pressed', String(dark));
    stage.classList.toggle('dark', dark);
    scene.clearColor = dark ? new Color4(0.095, 0.125, 0.16, 1)
      : new Color4(0.98, 0.98, 0.985, 1);
  });
  document.querySelector('#capture')!.addEventListener('click', () => {
    scene.render();
    download(canvas.toDataURL('image/png'), `reference-hero-${activeView}.png`);
    renderStatus.textContent = '视图已保存';
  });
  exportButton.addEventListener('click', () => {
    const serialized = SceneSerializer.SerializeMesh([...hero.meshes], true, false);
    serialized.metadata = {heightMeters: hero.height, armSpanMeters: hero.span, pose: 'T'};
    download(new Blob([JSON.stringify(serialized)], {type: 'application/json'}), 'reference-hero.babylon');
    renderStatus.textContent = '模型已导出';
  });

  const resize = new ResizeObserver(() => {
    engine.resize();
    frame();
  });
  resize.observe(stage);
  frame();
  scene.onBeforeRenderObservable.add(() => {
    if (rotating) camera.alpha += engine.getDeltaTime() * 0.00018;
  });
  engine.runRenderLoop(() => scene.render());
  await scene.whenReadyAsync();
  loading.hidden = true;
  renderStatus.textContent = '模型就绪';

  window.addEventListener('pagehide', () => {
    imageController.abort();
    resize.disconnect();
    engine.stopRenderLoop();
    scene.dispose();
    engine.dispose();
    releaseImageResources();
  }, {once: true});
}

start().catch(error => {
  loading.textContent = error instanceof Error ? error.message : '模型加载失败';
  renderStatus.textContent = '加载失败';
});
