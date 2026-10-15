import type {PostProcess, Scene, WebGPUEngine} from '@babylonjs/core';
import type {WebGPURenderTargetWrapper} from '@babylonjs/core/Engines/WebGPU/webgpuRenderTargetWrapper';
import {WebGPUCacheBindGroups} from '@babylonjs/core/Engines/WebGPU/webgpuCacheBindGroups';
import {getDisplayPreferences, subscribeDisplayPreferences} from '../interface/settings/display-preferences';
import './fps-display.css';

/** Frame counters and the FPS readout share a one-second sample. */
export function webGpuFrameStats(canvas: HTMLCanvasElement, scene: Scene, engine: WebGPUEngine,
  worldPass: () => PostProcess | undefined) {
  const fpsDisplay = document.createElement('output');
  fpsDisplay.className = 'game-fps';
  fpsDisplay.dataset.gameFps = '';
  fpsDisplay.setAttribute('aria-label', '帧率与渲染耗时');
  fpsDisplay.setAttribute('aria-live', 'off');
  fpsDisplay.style.whiteSpace = 'pre-line';
  fpsDisplay.textContent = 'FPS: —';
  const updateVisibility = (): void => {fpsDisplay.hidden = !getDisplayPreferences().showFps;};
  updateVisibility();
  document.body.appendChild(fpsDisplay);
  const unsubscribeDisplay = subscribeDisplayPreferences(updateVisibility);
  let publishedAt = performance.now();
  let frames = 0, cpuTime = 0;
  let previousFrameAt: number | undefined;
  let previousFrameEndedAt: number | undefined;
  const frameIntervals: number[] = [];
  let frameStartedAt = 0, meshStartedAt = 0, drawStartedAt = 0;
  let frameUpdateTime = 0, frameMeshTime = 0, frameDrawTime = 0;
  let updateTime = 0, meshTime = 0, drawTime = 0, uiTime = 0, otherTime = 0;
  let gapTime = 0, gaps = 0, profiledFrames = 0;
  const beforeMeshes = scene.onBeforeActiveMeshesEvaluationObservable.add(() => {
    if (fpsDisplay.hidden) return;
    meshStartedAt = performance.now();
    frameUpdateTime = meshStartedAt - frameStartedAt;
  });
  const afterMeshes = scene.onAfterActiveMeshesEvaluationObservable.add(() => {
    if (!fpsDisplay.hidden) frameMeshTime += performance.now() - meshStartedAt;
  });
  const beforeDraw = scene.onBeforeDrawPhaseObservable.add(() => {
    if (!fpsDisplay.hidden) drawStartedAt = performance.now();
  });
  const afterDraw = scene.onAfterDrawPhaseObservable.add(() => {
    if (!fpsDisplay.hidden) frameDrawTime += performance.now() - drawStartedAt;
  });
  let previousDrawCalls = engine._drawCalls.current, drawCalls = 0;
  canvas.dataset.gpuTiming = engine.getCaps().timerQuery ? 'available' : 'unavailable';
  const beginFrame = (startedAt: number): void => {
    frameStartedAt = startedAt;
    frameUpdateTime = frameMeshTime = frameDrawTime = 0;
  };
  const recordFrame = (startedAt: number, worldFinishedAt: number): void => {
    const now = performance.now();
    cpuTime += now - startedAt;
    if (!fpsDisplay.hidden) {
      if (previousFrameAt !== undefined) frameIntervals.push(startedAt - previousFrameAt);
      previousFrameAt = startedAt;
      if (previousFrameEndedAt !== undefined) {
        gapTime += startedAt - previousFrameEndedAt;
        gaps++;
      }
      updateTime += frameUpdateTime;
      meshTime += frameMeshTime;
      drawTime += frameDrawTime;
      uiTime += now - worldFinishedAt;
      otherTime += Math.max(0, worldFinishedAt - startedAt - frameUpdateTime - frameMeshTime - frameDrawTime);
      profiledFrames++;
      previousFrameEndedAt = now;
    } else {
      previousFrameAt = undefined;
      previousFrameEndedAt = undefined;
      frameIntervals.length = 0;
    }
    const currentDrawCalls = engine._drawCalls.current;
    drawCalls += currentDrawCalls >= previousDrawCalls ? currentDrawCalls - previousDrawCalls : currentDrawCalls;
    previousDrawCalls = currentDrawCalls;
    frames++;
    if (now - publishedAt < 1000) return;
    const fps = Math.round(frames * 1000 / (now - publishedAt));
    canvas.dataset.frameMs = ((now - publishedAt) / frames).toFixed(2);
    canvas.dataset.renderCpuMs = (cpuTime / frames).toFixed(2);
    canvas.dataset.drawCalls = (drawCalls / frames).toFixed(0);
    canvas.dataset.activeTriangles = String(scene.getActiveIndices() / 3);
    const gpu = engine.enableGPUTimingMeasurements ? engine.gpuTimeInFrameForMainPass?.counter : undefined;
    canvas.dataset.gpuMainPassMs = gpu?.count ? (gpu.current / 1e6).toFixed(2) : 'unavailable';
    const worldTarget = worldPass()?.inputTexture as WebGPURenderTargetWrapper | undefined;
    const worldGpu = engine.enableGPUTimingMeasurements ? worldTarget?.gpuTimeInFrame?.counter : undefined;
    canvas.dataset.gpuWorldPassMs = worldGpu?.count ? (worldGpu.current / 1e6).toFixed(2) : 'unavailable';
    canvas.dataset.gpuTimingEnabled = String(engine.enableGPUTimingMeasurements);
    if (!fpsDisplay.hidden) {
      frameIntervals.sort((left, right) => left - right);
      const p95 = frameIntervals[Math.ceil(frameIntervals.length * .95) - 1];
      canvas.dataset.frameP95Ms = p95 === undefined ? 'unavailable' : p95.toFixed(2);
      const gpuMs = worldGpu?.count ? (worldGpu.current / 1e6).toFixed(1) : '—';
      const outputGpuMs = gpu?.count ? (gpu.current / 1e6).toFixed(1) : '—';
      const phase = (milliseconds: number): string => (milliseconds / profiledFrames).toFixed(1);
      canvas.dataset.cpuUpdateMs = phase(updateTime);
      canvas.dataset.cpuMeshMs = phase(meshTime);
      canvas.dataset.cpuDrawMs = phase(drawTime);
      canvas.dataset.cpuUiMs = phase(uiTime);
      canvas.dataset.cpuOtherMs = phase(otherTime);
      canvas.dataset.frameGapMs = gaps ? (gapTime / gaps).toFixed(1) : 'unavailable';
      fpsDisplay.textContent = `FPS: ${fps} | CPU: ${(cpuTime / frames).toFixed(1)}ms`
        + ` | GPU3D: ${gpuMs}ms | GPUout: ${outputGpuMs}ms | P95: ${p95 === undefined ? '—' : p95.toFixed(1)}ms`
        + `\nUpdate: ${phase(updateTime)} | Mesh: ${phase(meshTime)} | Draw: ${phase(drawTime)}`
        + ` | UI: ${phase(uiTime)} | Other: ${phase(otherTime)} | Gap: ${canvas.dataset.frameGapMs}`
        + ` | DC: ${canvas.dataset.drawCalls}`;
      const music = document.querySelector<HTMLAudioElement>('audio[data-source-audio="battle-music"]');
      if (music) {
        const state = music.dataset.state === 'playing' && music.paused ? 'paused' : music.dataset.state;
        fpsDisplay.textContent += `\nMusic: ${state} | ID: ${music.dataset.musicId ?? '—'}`
          + ` | Time: ${music.currentTime.toFixed(1)} | Vol: ${music.volume.toFixed(2)}`
          + ` | Muted: ${Number(music.muted)} | Err: ${music.error?.code ?? music.dataset.error ?? '—'}`;
      }
      fpsDisplay.textContent += `\nResources: Mesh: ${scene.meshes.length} | Mat: ${scene.materials.length}`
        + ` | Dispose: ${scene.onDisposeObservable.observers.length}`
        + ` | BG: ${WebGPUCacheBindGroups.NumBindGroupsCreatedTotal}`;
      previousFrameEndedAt = performance.now();
    } else {
      fpsDisplay.textContent = `FPS: ${fps}`;
      delete canvas.dataset.frameP95Ms;
    }
    frameIntervals.length = 0;
    publishedAt = now;
    frames = cpuTime = drawCalls = 0;
    updateTime = meshTime = drawTime = uiTime = otherTime = gapTime = gaps = profiledFrames = 0;
  };
  return {beginFrame, recordFrame, dispose(): void {
    scene.onBeforeActiveMeshesEvaluationObservable.remove(beforeMeshes);
    scene.onAfterActiveMeshesEvaluationObservable.remove(afterMeshes);
    scene.onBeforeDrawPhaseObservable.remove(beforeDraw);
    scene.onAfterDrawPhaseObservable.remove(afterDraw);
    unsubscribeDisplay();
    fpsDisplay.remove();
  }};
}
