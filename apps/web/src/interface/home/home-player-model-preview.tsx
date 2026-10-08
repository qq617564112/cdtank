import './home-player-model-preview.css';
import {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {ArcRotateCamera, Color3, Color4, Engine, HemisphericLight, Scene, Vector3} from '@babylonjs/core';
import {readOwnedTankTextures, type OwnedTankTextures} from '../../../../shared/combat/role-owned-textures';
import type {ResOwnedRoles} from '../../../../shared/protocols/PtlOwnedRoles';
import type {ResRoleProfile} from '../../../../shared/protocols/PtlRoleProfile';
import {PetView} from '../../assets/pets/pet-view';
import {TankView} from '../../assets/tanks/tank-view';
import {HomeSourceLayout, type HomeSourceUi} from '../resources/source-ui-layout';
import {sourceProps} from '../resources/source-ui-props';
import {positionHomePlayerModels} from './home-player-model-scene';

interface PreviewProps {
  ui: HomeSourceUi;
  profile?: ResRoleProfile['profile'];
  owned?: ResOwnedRoles;
  loading: boolean;
  error: string;
  scale: number;
}

interface SelectedModels {
  tankId: number;
  petId: number;
  tankInstanceId: number;
  petInstanceId: number;
  textures?: OwnedTankTextures;
}

function selectedModels(profile: ResRoleProfile['profile'], owned?: ResOwnedRoles): SelectedModels | undefined {
  if (!profile || !owned) return undefined;
  const bytes = new DataView(Uint8Array.from(profile.bytes).buffer);
  const tankInstanceId = bytes.getUint32(0xa8, true);
  const petInstanceId = bytes.getUint32(0xa4, true);
  const tank = owned.equipment.find(record => new Map(record.fields).get(0x1c) === tankInstanceId);
  const pet = owned.base.find(record => new Map(record.fields).get(0) === petInstanceId);
  if (!tank || !pet) return undefined;
  const fields = new Map(tank.fields);
  const tankId = fields.get(0x24), petId = new Map(pet.fields).get(8);
  if (!tankId || !petId) return undefined;
  return {tankId, petId, tankInstanceId, petInstanceId,
    textures: readOwnedTankTextures({name: tank.name, fields})};
}

/** The player description region displays the currently selected owned models. */
export function HomePlayerModelPreview({ui, profile, owned, loading, error, scale}: PreviewProps) {
  const models = loading || error ? undefined : selectedModels(profile, owned);
  const message = error || (loading ? '载入角色…' : '请先选用坦克和宠物');
  const key = models && [models.tankInstanceId, models.petInstanceId, models.tankId, models.petId,
    models.textures?.U, models.textures?.M, models.textures?.XY].join(':');
  return <div className="home-player-model-preview" data-home-player-model-preview=""
    data-tank-instance-id={models?.tankInstanceId} data-pet-instance-id={models?.petInstanceId}
    {...sourceProps(ui, new HomeSourceLayout(ui, 'myhome_playerpage.xml'), 'myhome_playerpage.xml', 'edtPlayerDescription')}>
    {models ? <PlayerModels key={key} {...models} scale={scale} />
      : <span className="home-player-model-message" role="status">{message}</span>}
  </div>;
}

function PlayerModels({tankId, petId, tankInstanceId, textures, scale}: SelectedModels & {scale: number}) {
  const host = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const resizeAfterCommit = useRef<(() => void) | undefined>(undefined);
  const [message, setMessage] = useState('载入模型…');
  const [ready, setReady] = useState(false);
  const U = textures?.U, M = textures?.M, XY = textures?.XY;

  useLayoutEffect(() => {
    resizeAfterCommit.current?.();
  }, [scale]);

  useEffect(() => {
    const element = host.current!;
    let active = true;
    let engine: Engine | undefined;
    let scene: Scene | undefined;
    let tank: TankView | undefined;
    let pet: PetView | undefined;
    let observer: ResizeObserver | undefined;
    let pending: Promise<void> | undefined;
    let resizeFrame = 0;
    let renderReady = false;
    const resize = () => {
      const box = element.getBoundingClientRect();
      if (box.width > 0 && box.height > 0) engine?.setSize(Math.round(box.width), Math.round(box.height));
    };
    const scheduleResize = () => {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(resize);
    };
    const dispose = () => {
      tank?.dispose(); pet?.dispose(); scene?.dispose(); engine?.dispose();
    };
    setMessage('载入模型…'); setReady(false);
    try {
      const renderer = new Engine(canvas.current!, true, {alpha: true, stencil: true}, true);
      engine = renderer;
      const world = new Scene(renderer); scene = world;
      world.clearColor = new Color4(0, 0, 0, 0); world.ambientColor = Color3.White();
      const camera = new ArcRotateCamera('home-player-camera', -65 * Math.PI / 180,
        94 * Math.PI / 180, 220, Vector3.Zero(), world);
      camera.minZ = 0.5; camera.maxZ = 5000; camera.fov = 0.48;
      camera.inputs.clear();
      new HemisphericLight('home-player-light', new Vector3(0.2, 1, -0.5), world).intensity = 1.25;
      resizeAfterCommit.current = resize;
      observer = new ResizeObserver(resize); observer.observe(element);
      window.addEventListener('resize', scheduleResize);
      resize();
      renderer.runRenderLoop(() => {if (renderReady) world.render();});
      pending = (async () => {
        const selectedTextures = U === undefined || M === undefined || XY === undefined ? undefined : {U, M, XY};
        tank = await TankView.loadPreview(world, `home-player-tank-${tankInstanceId}`, tankId, selectedTextures);
        if (!active) return;
        pet = await PetView.load(world, petId);
        if (!active) return;
        positionHomePlayerModels(world, camera, tank.root, pet.root,
          renderer.getRenderWidth() / renderer.getRenderHeight());
        renderReady = true; setReady(true); setMessage('');
      })().catch(() => {
        if (active) setMessage('模型载入失败');
      });
    } catch {
      setMessage('模型载入失败');
    }
    return () => {
      active = false; resizeAfterCommit.current = undefined;
      observer?.disconnect(); window.removeEventListener('resize', scheduleResize);
      cancelAnimationFrame(resizeFrame); engine?.stopRenderLoop();
      // Allow an in-flight import to settle before releasing its scene and engine.
      if (pending) void pending.then(dispose);
      else dispose();
    };
  }, [tankId, petId, tankInstanceId, U, M, XY]);

  return <div ref={host} className="home-player-model-canvas" data-status={ready ? 'ready' : message === '模型载入失败' ? 'error' : 'loading'}
    data-tank-id={tankId} data-pet-id={petId}>
    <canvas ref={canvas} role="img" aria-label="当前选用的坦克和宠物" />
    {message && <span className="home-player-model-message" role="status">{message}</span>}
  </div>;
}
