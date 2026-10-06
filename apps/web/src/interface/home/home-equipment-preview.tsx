import {useEffect, useLayoutEffect, useRef, useState, type ComponentPropsWithoutRef} from 'react';
import {ArcRotateCamera, Color4, Engine, HemisphericLight, Scene, Vector3} from '@babylonjs/core';
import {TankView} from '../../assets/tanks/tank-view';
import type {OwnedTankTextures} from '../../../../shared/combat/role-owned-textures';
import {advanceHomePreviewOrbit, HOME_PREVIEW_CLIP_PLANES} from './home-preview-orbit';

interface PreviewProps extends ComponentPropsWithoutRef<'div'> {
  tankId: number;
  instanceId: number;
  textures?: OwnedTankTextures;
  scale: number;
}

interface PreviewRuntime {
  active: boolean;
  scene: Scene;
  camera: ArcRotateCamera;
  view?: TankView;
}

/** A mounted preview retains its scene while owned tank sources change. */
export function HomeEquipmentPreview({tankId, instanceId, textures, scale, ...props}: PreviewProps) {
  const host = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const runtime = useRef<PreviewRuntime | undefined>(undefined);
  const resizeAfterCommit = useRef<(() => void) | undefined>(undefined);
  const [message, setMessage] = useState('载入战车模型…');
  const U = textures?.U, M = textures?.M, XY = textures?.XY;

  useLayoutEffect(() => {
    resizeAfterCommit.current?.();
  }, [scale]);

  useEffect(() => {
    const element = host.current!;
    let engine: Engine | undefined;
    let current: PreviewRuntime | undefined;
    let observer: ResizeObserver | undefined;
    let resizeFrame = 0;
    const resize = () => {
      const box = element.getBoundingClientRect();
      if (box.width > 0 && box.height > 0) engine?.setSize(Math.round(box.width), Math.round(box.height));
    };
    const scheduleResize = () => {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(resize);
    };
    try {
      engine = new Engine(canvas.current!, true, {alpha: true}, true);
      const scene = new Scene(engine); scene.clearColor = new Color4(0, 0, 0, 0);
      const camera = new ArcRotateCamera('home-equipment-camera', -Math.PI / 2.5, Math.PI / 3, 100, Vector3.Zero(), scene);
      camera.minZ = HOME_PREVIEW_CLIP_PLANES.near; camera.maxZ = HOME_PREVIEW_CLIP_PLANES.far;
      camera.attachControl(canvas.current!, true);
      new HemisphericLight('home-equipment-light', new Vector3(0, 1, 0), scene).intensity = 1.2;
      const mounted: PreviewRuntime = {active: true, scene, camera};
      current = mounted; runtime.current = mounted;
      resizeAfterCommit.current = resize;
      const orbit = {pitch: 0, yaw: 0, orbitYaw: 0};
      let frames = 0;
      engine.runRenderLoop(() => {
        const previous = orbit.orbitYaw;
        advanceHomePreviewOrbit(orbit);
        camera.alpha += orbit.orbitYaw - previous;
        element.dataset.orbitYaw = String(orbit.orbitYaw);
        scene.render(); element.dataset.frames = String(++frames);
        if (mounted.view) element.dataset.renderedTankId = String(mounted.view.tankId);
      });
      observer = new ResizeObserver(resize); observer.observe(element);
      window.addEventListener('resize', scheduleResize);
      resize();
    } catch (error) {
      element.dataset.status = 'error'; setMessage(`模型载入失败：${String(error)}`);
    }
    return () => {
      if (current) current.active = false;
      runtime.current = undefined; resizeAfterCommit.current = undefined;
      observer?.disconnect(); window.removeEventListener('resize', scheduleResize);
      cancelAnimationFrame(resizeFrame);
      engine?.stopRenderLoop();
      current?.view?.dispose();
      if (current) {current.view = undefined; current.scene.dispose();}
      engine?.dispose();
      element.dataset.status = 'empty'; element.dataset.meshes = '0';
      delete element.dataset.renderedTankId;
    };
  }, []);

  useEffect(() => {
    const current = runtime.current;
    if (!current) return;
    const element = host.current!;
    let active = true;
    let loaded: TankView | undefined;
    element.dataset.status = 'loading'; element.dataset.meshes = '0';
    delete element.dataset.renderedTankId;
    setMessage('载入战车模型…');
    void (async () => {
      const selectedTextures = U === undefined || M === undefined || XY === undefined ? undefined : {U, M, XY};
      const view = await TankView.loadPreview(current.scene, `home-equipment-${instanceId}`, tankId, selectedTextures);
      if (!active || !current.active) {view.dispose(); return;}
      loaded = view; current.view = view;
      const meshes = view.root.getChildMeshes().filter(mesh => mesh.isEnabled() && mesh.getTotalVertices() > 0);
      let min = new Vector3(Infinity, Infinity, Infinity), max = new Vector3(-Infinity, -Infinity, -Infinity);
      for (const mesh of meshes) {
        mesh.computeWorldMatrix(true);
        const box = mesh.getBoundingInfo().boundingBox;
        min = Vector3.Minimize(min, box.minimumWorld); max = Vector3.Maximize(max, box.maximumWorld);
      }
      if (!meshes.length) throw new Error('战车模型没有可显示的网格');
      current.camera.target = min.add(max).scale(0.5);
      current.camera.radius = Math.max(max.subtract(min).length(), 1) * 1.4;
      current.camera.lowerRadiusLimit = current.camera.radius / 2; current.camera.upperRadiusLimit = current.camera.radius * 3;
      element.dataset.meshes = String(meshes.length); element.dataset.status = 'ready';
      setMessage('');
    })().catch(error => {
      if (!active || !current.active) return;
      loaded?.dispose(); current.view = undefined;
      element.dataset.status = 'error'; setMessage(`模型载入失败：${String(error)}`);
    });
    return () => {
      active = false;
      if (loaded && current.view === loaded) {loaded.dispose(); current.view = undefined;}
    };
  }, [tankId, instanceId, U, M, XY]);

  return <div {...props} ref={host} className="home-tank-preview" data-role-preview=""
    data-tank-id={tankId} data-instance-id={instanceId} data-tank-textures={JSON.stringify(textures ?? null)}>
    <canvas ref={canvas} aria-label="拥有战车模型预览" />
    <output aria-live="polite">{message}</output>
  </div>;
}
