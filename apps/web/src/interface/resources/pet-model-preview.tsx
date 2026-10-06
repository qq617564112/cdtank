import './pet-model-preview.css';
import {useEffect, useLayoutEffect, useRef, useState, type ComponentPropsWithoutRef} from 'react';
import {ArcRotateCamera, Color3, Color4, Engine, HemisphericLight, Scene, Vector3} from '@babylonjs/core';
import {PetView} from '../../assets/pets/pet-view';

interface PetModelPreviewProps extends ComponentPropsWithoutRef<'div'> {
  petId: number;
  kind: 'home' | 'shop';
  scale: number;
}

interface PreviewRuntime {
  active: boolean;
  engine: Engine;
  scene: Scene;
  camera: ArcRotateCamera;
  view?: PetView;
  resize: () => void;
}

/** Original PetTable selects the n1 model; page framing and loop presentation are reconstructed. */
export function PetModelPreview({petId, kind, scale, ...props}: PetModelPreviewProps) {
  const host = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const runtime = useRef<PreviewRuntime | undefined>(undefined);
  const [message, setMessage] = useState('载入宠物模型…');


  useLayoutEffect(() => {runtime.current?.resize();}, [scale]);

  useEffect(() => {
    const element = host.current!;
    const engine = new Engine(canvas.current!, true, {alpha: true}, true);
    const scene = new Scene(engine);
    scene.clearColor = new Color4(0, 0, 0, 0);
    scene.ambientColor = Color3.White();
    const camera = new ArcRotateCamera('pet-preview-camera', -Math.PI / 2.5,
      Math.PI / 3, 100, Vector3.Zero(), scene);
    camera.minZ = 10; camera.maxZ = 5000;
    camera.attachControl(canvas.current!, true);
    camera.inputs.removeByType('ArcRotateCameraKeyboardMoveInput');
    camera.inputs.removeByType('ArcRotateCameraMouseWheelInput');
    let dragging = false;
    const startDrag = () => {dragging = true;};
    const finishDrag = () => {dragging = false;};
    const surface = canvas.current!;
    surface.addEventListener('pointerdown', startDrag);
    surface.addEventListener('pointerup', finishDrag);
    surface.addEventListener('pointercancel', finishDrag);
    surface.addEventListener('lostpointercapture', finishDrag);
    new HemisphericLight('pet-preview-light', new Vector3(0, 1, 0), scene).intensity = 1.2;
    const resize = () => {
      const box = element.getBoundingClientRect();
      if (box.width > 0 && box.height > 0) engine.setSize(Math.round(box.width), Math.round(box.height));
    };
    const mounted: PreviewRuntime = {active: true, engine, scene, camera, resize};
    runtime.current = mounted;
    let frames = 0;
    engine.runRenderLoop(() => {
      if (!dragging) camera.alpha += .0075;
      element.dataset.orbitYaw = String(camera.alpha);
      element.dataset.orbitPitch = String(camera.beta);
      scene.render();
      element.dataset.frames = String(++frames);
      if (mounted.view) element.dataset.renderedPetId = String(mounted.view.petId);
    });
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    resize();
    return () => {
      mounted.active = false;
      runtime.current = undefined;
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
      delete element.dataset.renderedPetId;
    };
  }, [kind]);

  useEffect(() => {
    const current = runtime.current;
    if (!current) return;
    const element = host.current!;
    let active = true;
    let loaded: PetView | undefined;
    element.dataset.status = 'loading'; element.dataset.meshes = '0';
    delete element.dataset.renderedPetId;
    setMessage('载入宠物模型…');
    void PetView.load(current.scene, petId).then(view => {
      if (!active || !current.active) {view.dispose(); return;}
      loaded = view; current.view = view;
      const meshes = view.root.getChildMeshes().filter(mesh => mesh.isEnabled() && mesh.getTotalVertices() > 0);
      if (!meshes.length) throw new Error('宠物模型没有可显示的网格');
      let min = new Vector3(Infinity, Infinity, Infinity), max = new Vector3(-Infinity, -Infinity, -Infinity);
      for (const mesh of meshes) {
        mesh.computeWorldMatrix(true);
        const box = mesh.getBoundingInfo().boundingBox;
        min = Vector3.Minimize(min, box.minimumWorld);
        max = Vector3.Maximize(max, box.maximumWorld);
      }
      current.camera.target = min.add(max).scale(0.5);
      current.camera.radius = Math.max(max.subtract(min).length(), 1) * 1.4;
      element.dataset.status = 'ready'; element.dataset.meshes = String(meshes.length);
      setMessage('');
    }).catch(error => {
      if (!active || !current.active) return;
      loaded?.dispose(); current.view = undefined;
      console.error('宠物预览模型载入失败', error);
      element.dataset.status = 'error'; setMessage('模型载入失败，请刷新页面重试。');
    });
    return () => {
      active = false;
      if (loaded && current.view === loaded) {loaded.dispose(); current.view = undefined;}
    };
  }, [petId, kind]);

  return <div {...props} ref={host} className="pet-model-preview" data-pet-model-preview="" data-pet-id={petId} data-preview-kind={kind}>
    <canvas ref={canvas} aria-label="商品宠物模型预览"/>
    <output aria-live="polite">{message}</output>
  </div>;
}
