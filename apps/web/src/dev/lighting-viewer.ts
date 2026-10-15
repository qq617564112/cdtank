import './lighting-viewer.css';
import {ArcRotateCamera, Color3, Color4, HemisphericLight, MeshBuilder, Scene,
  ShaderMaterial, ShadowGenerator, TransformNode, Vector3} from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import {TankView, tankCatalog} from '../assets/tanks/tank-view';
import {prepareArtworkManifest} from '../assets/battle-artwork';
import {installModelImageLoader} from '../assets/model-image-loader';
import {prepareGameContent} from '../content';
import {SceneActorToon, registerSceneActorToon} from '../render/materials/actor-toon';
import {createMv3Material} from '../render/materials/mv3-material';
import {applySceneEnvironment} from '../render/scene-environment';
import {sceneEnvironmentFor} from '../../../shared/maps/scene-environment';
import {SceneShadowLight} from '../render/scene-shadow-light';
import {sceneShadowLightProfile} from '../render/scene-shadow-light-profiles';
import {BATTLE_CAMERA_SOURCE} from '../render/battle-camera';
import {selectEnabledMeshCandidates} from '../render/scene-mesh-candidates';
import {createWebGpuEngine} from '../render/webgpu-engine';

interface ViewerSettings {
  tankId: number;
  skin: 'default' | 'red';
  mode: 'original' | 'lighting' | 'shadows';
  mapId: string;
  extent: number;
  receive: boolean;
  cast: boolean;
  obstacle: boolean;
  yaw: number;
  elevation: number;
  action: 'idle' | 'move' | 'fire';
  playing: boolean;
  x: number;
  z: number;
  travel: boolean;
  follow: boolean;
}

const defaults: ViewerSettings = {tankId: 1, skin: 'red', mode: 'shadows', mapId: '0001',
  extent: 6000, receive: true, cast: true, obstacle: false, yaw: 0, elevation: 45,
  action: 'idle', playing: false, x: 0, z: 0, travel: false, follow: true};
const canvas = document.querySelector<HTMLCanvasElement>('#world')!;
const status = document.querySelector<HTMLOutputElement>('#status')!;
const controls = document.querySelector<HTMLFormElement>('#controls')!;
const input = <T extends HTMLElement>(id: string): T => document.querySelector<T>(`#${id}`)!;
const radians = (angle: number): number => angle * Math.PI / 180;

/** The diagnostic scene shares the game's actor, materials, light and WebGPU engine. */
class LightingViewer {
  settings = {...defaults};
  scene?: Scene;
  camera?: ArcRotateCamera;
  tank?: TankView;
  shadows?: SceneShadowLight;
  ready = false;
  private revision = 0;
  private loading = false;
  private fittedTarget = new Vector3(0, 25, 0);
  private fittedRadius = 170;
  private generator?: ShadowGenerator;
  private obstacle?: TransformNode;
  private travelTime = 0;

  constructor(private readonly engine: Awaited<ReturnType<typeof createWebGpuEngine>>) {
    engine.runRenderLoop(() => {
      if (this.loading || !this.scene) return;
      const delta = Math.min(engine.getDeltaTime() / 1000, .05);
      if (this.settings.playing) {
        this.tank?.advanceAnimations(delta);
        void this.tank?.motion(this.settings.action === 'move');
      }
      if (this.settings.travel) {this.travelTime += delta; this.setPosition();}
      this.scene.render();
    });
    new ResizeObserver(() => engine.resize()).observe(canvas);
  }

  async load(changes: Partial<ViewerSettings> = {}): Promise<void> {
    const revision = ++this.revision;
    this.ready = false;
    this.loading = true;
    this.travelTime = 0;
    controls.querySelectorAll<HTMLSelectElement | HTMLInputElement | HTMLButtonElement>('select, input, button')
      .forEach(control => {control.disabled = true;});
    try {
      this.settings = {...this.settings, ...changes};
      this.tank?.dispose();
      this.scene?.dispose();
      this.tank = undefined;
      this.shadows = undefined;
      this.generator = undefined;
      status.value = '正在载入游戏模型…';
      const scene = this.scene = new Scene(this.engine);
      scene.clearColor = new Color4(.78, .83, .86, 1);
      scene.animationsEnabled = false;
      applySceneEnvironment(scene, sceneEnvironmentFor(this.settings.mapId));
      selectEnabledMeshCandidates(scene);
      const camera = this.camera = new ArcRotateCamera('viewer-camera', -Math.PI / 2,
        radians(90 - this.settings.elevation), 170, this.fittedTarget, scene);
      camera.minZ = BATTLE_CAMERA_SOURCE.near;
      camera.maxZ = BATTLE_CAMERA_SOURCE.far;
      camera.lowerRadiusLimit = 50;
      camera.upperRadiusLimit = 700;
      camera.lowerBetaLimit = .02;
      camera.upperBetaLimit = Math.PI / 2 - .02;
      camera.attachControl(canvas, true);
      const sky = new HemisphericLight('sky', Vector3.Up(), scene);
      sky.intensity = 1.2;
      sky.groundColor = new Color3(.35, .35, .35);
      if (this.settings.mode !== 'original') {
        this.shadows = new SceneShadowLight(scene);
        this.generator = Reflect.get(this.shadows, 'generator') as ShadowGenerator;
      }
      const toon = new SceneActorToon(scene, this.settings.mapId);
      scene.onDisposeObservable.addOnce(() => toon.dispose());
      await toon.load();
      if (revision !== this.revision) return;
      registerSceneActorToon(toon);
      const ground = MeshBuilder.CreateGround('viewer-ground',
        {width: this.settings.extent, height: this.settings.extent}, scene);
      const properties = Array<number>(17).fill(0);
      properties[3] = properties[7] = 1;
      properties[4] = .55; properties[5] = .68; properties[6] = .5;
      ground.material = createMv3Material(scene, properties);
      this.shadows?.setTerrain(this.settings.mapId, [ground]);
      const obstacle = MeshBuilder.CreateBox('viewer-obstacle', {width: 75, height: 160, depth: 35}, scene);
      obstacle.position.set(-25, 80, -10);
      this.obstacle = obstacle;
      properties[4] = properties[5] = properties[6] = .6;
      obstacle.material = createMv3Material(scene, properties);
      this.shadows?.addRoot(obstacle, {meshes: () => [obstacle]});
      obstacle.setEnabled(this.settings.obstacle);
      const definition = (await prepareGameContent()).tanks.get(this.settings.tankId)!;
      const textures = {...definition.textures};
      if (this.settings.skin === 'red') {
        for (const part of ['M', 'U', 'XY'] as const) {
          const row = definition.resources.textureVariants.find(row => row.part === part && /_021\./.test(row.filename));
          if (row) textures[part] = row.recordId;
        }
      }
      // Freeze the actor's automatic clock; manual animation advances keep comparisons repeatable.
      const existing = new Set(scene.onBeforeRenderObservable.observers);
      const tank = this.tank = await TankView.loadPreview(scene, 'viewer-tank', this.settings.tankId, textures);
      for (const observer of [...scene.onBeforeRenderObservable.observers]) {
        if (!existing.has(observer)) scene.onBeforeRenderObservable.remove(observer);
      }
      if (revision !== this.revision) return;
      tank.root.computeWorldMatrix(true);
      const bounds = tank.root.getHierarchyBoundingVectors(true);
      this.fittedTarget = bounds.min.add(bounds.max).scale(.5);
      this.fittedRadius = Math.max(120, Vector3.Distance(bounds.min, bounds.max) * 1.5);
      this.shadows?.addRoot(tank.root, {dynamic: true, softShadows: false,
        meshes: () => tank.root.getChildMeshes().filter(mesh => mesh.isEnabled())});
      scene.onBeforeCameraRenderObservable.add(() => {
        if (!this.tank) return;
        const meshes = this.tank.root.getChildMeshes();
        for (const mesh of meshes) {
          if (mesh.material instanceof ShaderMaterial) {
            mesh.material.setFloat('sceneShadowOcclusion', this.settings.receive && this.settings.mode === 'shadows' ? 1 : 0);
          }
        }
        const map = this.generator?.getShadowMap();
        for (const mesh of scene.meshes) {
          if (!meshes.includes(mesh) && mesh.material instanceof ShaderMaterial) {
            mesh.material.setFloat('sceneShadowOcclusion', this.settings.mode === 'shadows' ? 1 : 0);
          }
        }
        if (map?.renderList && !this.settings.cast) {
          const tanks = new Set(meshes);
          map.renderList = map.renderList.filter(mesh => !tanks.has(mesh));
        }
      });
      await this.setAction(this.settings.action);
      this.resetCamera();
      this.setPose();
      this.writeControls();
      this.loading = false;
      await scene.whenReadyAsync();
      await this.frame();
      this.ready = true;
      const profile = sceneShadowLightProfile(this.settings.mapId);
      status.value = `${definition.name} · ${this.settings.mode === 'original' ? '原版卡通' : profile.kind} · WebGPU · 可对照`;
    } finally {
      if (revision === this.revision) {
        this.loading = false;
        controls.querySelectorAll<HTMLSelectElement | HTMLInputElement | HTMLButtonElement>('select, input, button')
          .forEach(control => {control.disabled = false;});
      }
    }
  }

  async setAction(action: ViewerSettings['action']): Promise<void> {
    if (action !== 'fire' && this.tank?.activeAction === '03') {
      await this.load({action});
      return;
    }
    this.settings.action = action;
    await this.tank?.motion(action === 'move');
    if (action === 'fire') await this.tank?.fire();
    this.tank?.advanceAnimations(0);
  }

  setPose(): void {
    if (this.tank) this.tank.root.rotation.y = radians(this.settings.yaw);
    if (this.camera) this.camera.beta = radians(90 - this.settings.elevation);
    this.obstacle?.setEnabled(this.settings.obstacle);
    this.setPosition();
  }

  setPosition(): void {
    const x = this.settings.x + (this.settings.travel ? 50 * Math.sin(this.travelTime) : 0);
    const z = this.settings.z + (this.settings.travel ? 35 * (Math.cos(this.travelTime) - 1) : 0);
    this.tank?.root.position.set(x, 0, z);
    input<HTMLInputElement>('x').value = String(this.settings.x);
    input<HTMLInputElement>('z').value = String(this.settings.z);
    if (this.settings.follow) this.camera?.setTarget(this.fittedTarget.add(new Vector3(x, 0, z)), false, true, true);
  }

  resetCamera(): void {
    this.camera?.setTarget(this.fittedTarget.add(this.tank?.root.position ?? Vector3.Zero()));
    if (this.camera) {
      this.camera.alpha = -Math.PI / 2;
      this.camera.beta = radians(90 - this.settings.elevation);
      this.camera.radius = this.fittedRadius;
    }
  }

  async frame(): Promise<void> {
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  }

  state(): object {
    const generator = this.generator;
    const map = generator?.getShadowMap();
    return {ready: this.ready, settings: this.settings, shadowType: map?.textureType,
      casters: map?.renderList?.length, float32Filterable: this.engine.getCaps().textureFloatLinearFiltering,
      meshes: this.scene?.meshes.filter(mesh => mesh.isEnabled()).length,
      light: this.generator?.getLight().direction.asArray(),
      position: this.tank?.root.position.asArray(), tankAction: this.tank?.activeAction,
      camera: this.camera?.position.asArray(),
      shadowMapSize: map?.getSize(), shadowPasses: generator ? 1 : 0,
      projection: generator ? Array.from(generator.projectionMatrix.m) : undefined};
  }

  writeControls(): void {
    for (const [id, value] of Object.entries({tank: this.settings.tankId, skin: this.settings.skin,
      mode: this.settings.mode, map: this.settings.mapId, extent: this.settings.extent,
      yaw: this.settings.yaw, elevation: this.settings.elevation, x: this.settings.x, z: this.settings.z, action: this.settings.action})) {
      input<HTMLInputElement | HTMLSelectElement>(id).value = String(value);
    }
    for (const id of ['receive', 'cast', 'obstacle', 'playing', 'travel', 'follow'] as const) {
      input<HTMLInputElement>(id).checked = this.settings[id];
    }
  }
}

async function start(): Promise<void> {
  installModelImageLoader();
  await prepareArtworkManifest();
  const engine = await createWebGpuEngine(canvas);
  const viewer = new LightingViewer(engine);
  Reflect.set(window, 'lightingViewer', viewer);
  for (const entry of await tankCatalog()) {
    input<HTMLSelectElement>('tank').add(new Option(`${entry.id} · ${entry.name}`, String(entry.id)));
  }
  controls.addEventListener('submit', event => event.preventDefault());
  controls.addEventListener('change', event => {
    const target = event.target as HTMLInputElement | HTMLSelectElement;
    if (target.id === 'action') {
      void viewer.setAction(target.value as ViewerSettings['action'])
        .catch(error => {status.value = String(error);});
    } else if (target instanceof HTMLInputElement && target.type === 'checkbox') {
      Reflect.set(viewer.settings, target.id, target.checked);
      viewer.setPose();
    } else if (target.id === 'x' || target.id === 'z') {
      viewer.settings[target.id] = Number(target.value);
      viewer.setPosition();
    } else if (target.id !== 'yaw' && target.id !== 'elevation') {
      const aliases: Readonly<Record<string, string>> = {tank: 'tankId', map: 'mapId'};
      const key = aliases[target.id] ?? target.id;
      void viewer.load({[key]: ['tank', 'extent'].includes(target.id) ? Number(target.value) : target.value})
        .catch(error => {status.value = String(error);});
    }
  });
  for (const id of ['yaw', 'elevation'] as const) {
    input<HTMLInputElement>(id).addEventListener('input', event => {
      viewer.settings[id] = Number((event.target as HTMLInputElement).value);
      viewer.setPose();
    });
  }
  for (const button of controls.querySelectorAll<HTMLButtonElement>('[data-nudge]')) {
    button.onclick = () => {
      viewer.settings.x += Number(button.dataset.nudge);
      input<HTMLInputElement>('x').value = String(viewer.settings.x);
      viewer.setPosition();
    };
  }
  input<HTMLButtonElement>('reset').onclick = () => viewer.resetCamera();
  input<HTMLButtonElement>('capture').onclick = async () => {
    await viewer.frame();
    const {CreateScreenshotAsync} = await import('@babylonjs/core/Misc/screenshotTools');
    const data = await CreateScreenshotAsync(engine, viewer.camera!, {precision: 1});
    const link = document.createElement('a');
    link.href = data;
    link.download = `tank-${viewer.settings.tankId}-${viewer.settings.mode}.png`;
    link.click();
  };
  await viewer.load();
}

void start().catch(error => {status.value = String(error); console.error(error);});
