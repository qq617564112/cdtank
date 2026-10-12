import type {Scene, WebGPUEngine} from '@babylonjs/core';
import {getDisplayPreferences, subscribeDisplayPreferences} from '../interface/settings/display-preferences';
import './fps-display.css';

/** Frame counters and the FPS readout share a one-second sample. */
export function webGpuFrameStats(canvas: HTMLCanvasElement, scene: Scene, engine: WebGPUEngine) {
  const fpsDisplay = document.createElement('output');
  fpsDisplay.className = 'game-fps';
  fpsDisplay.dataset.gameFps = '';
  fpsDisplay.setAttribute('aria-label', '每秒帧数');
  fpsDisplay.setAttribute('aria-live', 'off');
  fpsDisplay.textContent = 'FPS: —';
  const updateVisibility = (): void => {fpsDisplay.hidden = !getDisplayPreferences().showFps;};
  updateVisibility();
  document.body.appendChild(fpsDisplay);
  const unsubscribeDisplay = subscribeDisplayPreferences(updateVisibility);
  let publishedAt = performance.now();
  let frames = 0, cpuTime = 0;
  let previousDrawCalls = engine._drawCalls.current, drawCalls = 0;
  canvas.dataset.gpuTiming = engine.getCaps().timerQuery ? 'available' : 'unavailable';
  const recordFrame = (startedAt: number): void => {
    const now = performance.now();
    cpuTime += now - startedAt;
    const currentDrawCalls = engine._drawCalls.current;
    drawCalls += currentDrawCalls >= previousDrawCalls ? currentDrawCalls - previousDrawCalls : currentDrawCalls;
    previousDrawCalls = currentDrawCalls;
    frames++;
    if (now - publishedAt < 1000) return;
    fpsDisplay.textContent = `FPS: ${Math.round(frames * 1000 / (now - publishedAt))}`;
    canvas.dataset.frameMs = ((now - publishedAt) / frames).toFixed(2);
    canvas.dataset.renderCpuMs = (cpuTime / frames).toFixed(2);
    canvas.dataset.drawCalls = (drawCalls / frames).toFixed(0);
    canvas.dataset.activeTriangles = String(scene.getActiveIndices() / 3);
    const gpu = engine.gpuTimeInFrameForMainPass?.counter;
    canvas.dataset.gpuMainPassMs = gpu?.count ? (gpu.current / 1e6).toFixed(2) : 'unavailable';
    publishedAt = now;
    frames = cpuTime = drawCalls = 0;
  };
  return {recordFrame, dispose(): void {
    unsubscribeDisplay();
    fpsDisplay.remove();
  }};
}
