import {ArcRotateCamera, ImportMeshAsync, Scene} from '@babylonjs/core';
import {ScenePreview} from '../../apps/web/src/assets/scenes/scene-preview';
import {applyMv3Materials} from '../../apps/web/src/render/materials/mv3-material';

interface ModelEntry {
  path: string;
  output: string;
  meshes: number;
  tracks: number;
  frames: number;
}

/** Own the legacy asset inspection controls and their preview resources. */
export function createAssetViewer(scene: Scene, camera: ArcRotateCamera): {suspend(): void; resume(): void} {
  const select = document.querySelector<HTMLSelectElement>('#model')!;
  const status = document.querySelector<HTMLOutputElement>('#status')!;
  const animationButton = document.querySelector<HTMLButtonElement>('#animation')!;
  let container: Awaited<ReturnType<typeof ImportMeshAsync>> | undefined;
  let loading = false;
  const scenePreview = new ScenePreview(scene, camera);
  
  async function loadModel(path: string): Promise<void> {
    if (loading) {
      return;
    }
    scenePreview.clear();
    loading = true;
    select.disabled = true;
    status.value = '载入模型…';
    try {
      container?.animationGroups.forEach(group => group.dispose());
      container?.meshes.forEach(mesh => mesh.dispose(false, true));
      container = await ImportMeshAsync(`/${path}`, scene);
      applyMv3Materials(scene, container.meshes);
      const bounds = container.meshes[0].getHierarchyBoundingVectors();
      camera.target = bounds.min.add(bounds.max).scale(0.5);
      camera.radius = Math.max(bounds.max.subtract(bounds.min).length(), 1) * 1.4;
      camera.lowerRadiusLimit = camera.radius / 20;
      camera.upperRadiusLimit = camera.radius * 10;
      container.animationGroups.forEach(group => group.stop());
      animationButton.textContent = '播放动作';
      status.value = `${container.meshes.length - 1} 网格 · ${container.animationGroups.length} 动画`;
    } catch (error) {
      status.value = `载入失败：${error instanceof Error ? error.message : String(error)}`;
    } finally {
      loading = false;
      select.disabled = false;
    }
  }
  
  animationButton.addEventListener('click', () => {
    if (!container?.animationGroups.length) {
      return;
    }
    const play = !container.animationGroups.some(group => group.isPlaying);
    container.animationGroups.forEach(group => {
      if (play) {
        group.start(true);
      } else {
        group.stop();
      }
    });
    animationButton.textContent = play ? '停止动作' : '播放动作';
  });
  select.addEventListener('change', () => {void loadModel(select.value);});
  
  async function initialize(): Promise<void> {
    const response = await fetch('/mv3-conversion.json');
    if (!response.ok) {
      throw new Error('缺少模型目录，请先转换原版资源');
    }
    const entries: ModelEntry[] = await response.json();
    for (const catalog of ['pol-conversion.json', 'cvd-conversion.json']) {
      const extraResponse = await fetch(`/${catalog}`);
      if (extraResponse.ok) {
        entries.push(...await extraResponse.json() as ModelEntry[]);
      }
    }
    entries.sort((a, b) => a.path.localeCompare(b.path));
    for (const entry of entries) {
      const option = document.createElement('option');
      option.value = entry.output;
      option.textContent = entry.path.replace('Data/', '');
      select.append(option);
    }
    const initial = entries.find(entry => entry.path.toLowerCase().includes('role/001/01')) ?? entries[0];
    select.value = initial.output;
    await loadModel(initial.output);
  }
  
  initialize().catch(error => {status.value = String(error);});
  
  const sceneButton = document.querySelector<HTMLButtonElement>('#load-scene')!;
  sceneButton.addEventListener('click', () => {
    if (loading) {
      return;
    }
    loading = true;
    sceneButton.disabled = true;
    select.disabled = true;
    container?.meshes[0].setEnabled(false);
    const id = document.querySelector<HTMLSelectElement>('#scene')!.value;
    status.value = '载入原版地图物件…';
    void scenePreview.load(id).then(message => {status.value = message;}).catch(error => {
      status.value = String(error);
    }).finally(() => {
      loading = false;
      sceneButton.disabled = false;
      select.disabled = false;
    });
  });
  
  return {
    suspend(): void {
      scenePreview.clear();
      container?.meshes[0].setEnabled(false);
    },
    resume(): void {
      container?.meshes[0].setEnabled(true);
      void loadModel(select.value);
    },
  };
}
