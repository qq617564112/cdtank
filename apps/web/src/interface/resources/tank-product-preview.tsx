import './tank-product-preview.css';
import {useEffect, useLayoutEffect, useRef, useState, type ComponentPropsWithoutRef} from 'react';
import {ArcRotateCamera, Color3, Color4, HemisphericLight, Scene, Vector3, type WebGPUEngine} from '@babylonjs/core';
import {createWebGpuEngine} from '../../render/webgpu-engine';
import {TankView} from '../../assets/tanks/tank-view';
import type {OwnedTankTextures} from '../../../../shared/combat/role-owned-textures';

interface ProductPreviewProps extends ComponentPropsWithoutRef<'div'> {
  tankId: number;
  textures: OwnedTankTextures;
  scale: number;
}

interface PreviewRuntime {
  active: boolean;
  engine: WebGPUEngine;
  scene: Scene;
  camera: ArcRotateCamera;
  view?: TankView;
  resize: () => void;
}

/** Shop defaults supply the model/materials; framing is reconstructed. */
export function TankProductPreview({tankId, textures, scale, ...props}: ProductPreviewProps) {
  const host = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [runtime, setRuntime] = useState<PreviewRuntime>();
  const [message, setMessage] = useState('载入战车模型…');
  const {U, M, XY} = textures;

  useLayoutEffect(() => {runtime?.resize();}, [scale, runtime]);

  useEffect(() => {
    const element = host.current!;
    const surface = canvas.current!;
    let active = true;
    let dispose = () => {};
    void (async () => {
      const engine = await createWebGpuEngine(surface, true);
      if (!active) {engine.dispose(); return;}
      const scene = new Scene(engine);
      scene.clearColor = new Color4(0, 0, 0, 0);
      scene.ambientColor = Color3.White();
      const camera = new ArcRotateCamera('shop-product-camera', Math.PI / 2.5,
        Math.PI / 3, 100, Vector3.Zero(), scene);
      camera.minZ = 10; camera.maxZ = 5000;
      camera.attachControl(surface, true);
      camera.inputs.removeByType('ArcRotateCameraKeyboardMoveInput');
      camera.inputs.removeByType('ArcRotateCameraMouseWheelInput');
      let dragging = false;
      const startDrag = () => {dragging = true;};
      const finishDrag = () => {dragging = false;};
      surface.addEventListener('pointerdown', startDrag);
      surface.addEventListener('pointerup', finishDrag);
      surface.addEventListener('pointercancel', finishDrag);
      surface.addEventListener('lostpointercapture', finishDrag);
      new HemisphericLight('shop-product-light', new Vector3(0, 1, 0), scene).intensity = 1.2;
      const resize = () => {
        const box = element.getBoundingClientRect();
        if (box.width > 0 && box.height > 0) engine.setSize(Math.round(box.width), Math.round(box.height));
      };
      const mounted: PreviewRuntime = {active: true, engine, scene, camera, resize};
      let frames = 0;
      engine.runRenderLoop(() => {
        if (mounted.view && !dragging) camera.alpha += .0075;
        element.dataset.orbitYaw = String(camera.alpha);
        element.dataset.orbitPitch = String(camera.beta);
        scene.render();
        element.dataset.frames = String(++frames);
        if (mounted.view) element.dataset.renderedTankId = String(mounted.view.tankId);
      });
      const observer = new ResizeObserver(resize);
      observer.observe(element);
      resize();
      dispose = () => {
        mounted.active = false;
        observer.disconnect();
        camera.detachControl();
        surface.removeEventListener('pointerdown', startDrag);
        surface.removeEventListener('pointerup', finishDrag);
        surface.removeEventListener('pointercancel', finishDrag);
        surface.removeEventListener('lostpointercapture', finishDrag);
        engine.stopRenderLoop();
        mounted.view?.dispose(); mounted.view = undefined;
        scene.dispose(); engine.dispose();
        element.dataset.status = 'empty'; element.dataset.meshes = '0';
        delete element.dataset.renderedTankId;
      };
      setRuntime(mounted);
    })().catch(error => {
      if (!active) return;
      element.dataset.status = 'error'; setMessage(`模型载入失败：${String(error)}`);
    });
    return () => {active = false; dispose();};
  }, []);

  useEffect(() => {
    const current = runtime;
    if (!current?.active) return;
    const element = host.current!;
    let active = true;
    let loaded: TankView | undefined;
    element.dataset.status = 'loading'; element.dataset.meshes = '0';
    delete element.dataset.renderedTankId;
    setMessage('载入战车模型…');
    void TankView.loadPreview(current.scene, `shop-product-${tankId}`, tankId, {U, M, XY}).then(view => {
      if (!active || !current.active) {view.dispose(); return;}
      loaded = view; current.view = view;
      const meshes = view.root.getChildMeshes().filter(mesh => mesh.isEnabled() && mesh.getTotalVertices() > 0);
      if (!meshes.length) throw new Error('战车模型没有可显示的网格');
      let min = new Vector3(Infinity, Infinity, Infinity), max = new Vector3(-Infinity, -Infinity, -Infinity);
      for (const mesh of meshes) {
        mesh.computeWorldMatrix(true);
        const box = mesh.getBoundingInfo().boundingBox;
        min = Vector3.Minimize(min, box.minimumWorld);
        max = Vector3.Maximize(max, box.maximumWorld);
      }
      current.camera.target = min.add(max).scale(0.5);
      current.camera.radius = Math.max(max.subtract(min).length(), 1) * 1.4;
      current.camera.alpha = Math.PI / 2.5;
      current.camera.beta = Math.PI / 3;
      element.dataset.status = 'ready'; element.dataset.meshes = String(meshes.length);
      setMessage('');
    }).catch(error => {
      if (!active || !current.active) return;
      loaded?.dispose(); current.view = undefined;
      console.error('战车预览模型载入失败', error);
      element.dataset.status = 'error'; setMessage('模型载入失败，请刷新页面重试。');
    });
    return () => {
      active = false;
      if (loaded && current.view === loaded) {loaded.dispose(); current.view = undefined;}
    };
  }, [runtime, tankId, U, M, XY]);

  return <div {...props} ref={host} className="tank-product-preview" data-tank-id={tankId}
    data-tank-textures={JSON.stringify(textures)}>
    <canvas ref={canvas} aria-label="商品战车模型预览"/>
    <output aria-live="polite">{message}</output>
  </div>;
}
