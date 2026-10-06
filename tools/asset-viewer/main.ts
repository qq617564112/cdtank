import {ArcRotateCamera, Color3, Color4, Engine, HemisphericLight, Scene, Vector3} from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import './style.css';
import {createAssetViewer} from './asset-viewer';

const canvas = document.querySelector<HTMLCanvasElement>('#world')!;
const engine = new Engine(canvas, true, {}, true);
const scene = new Scene(engine);
scene.clearColor = new Color4(0.25, 0.36, 0.44, 1);
const camera = new ArcRotateCamera('camera', -Math.PI / 2, Math.PI / 3, 100, Vector3.Zero(), scene);
camera.attachControl(canvas, true);
camera.minZ = 0.1;
camera.maxZ = 100000;
const light = new HemisphericLight('sky', new Vector3(0, 1, 0), scene);
light.intensity = 1.2;
light.groundColor = new Color3(0.35, 0.35, 0.35);
createAssetViewer(scene, camera);
window.addEventListener('resize', () => {engine.resize();});
engine.runRenderLoop(() => {scene.render();});
