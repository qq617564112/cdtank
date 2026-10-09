import type {Scene, WebGPUEngine} from '@babylonjs/core';

/** Developer counters are published once per second without reading GPU pixels. */
export function webGpuFrameStats(canvas: HTMLCanvasElement, scene: Scene, engine: WebGPUEngine) {
  let publishedAt = performance.now();
  let frames = 0, cpuTime = 0;
  canvas.dataset.gpuTiming = engine.getCaps().timerQuery ? 'available' : 'unavailable';
  return (startedAt: number): void => {
    const now = performance.now();
    cpuTime += now - startedAt;
    frames++;
    if (now - publishedAt < 1000) return;
    canvas.dataset.frameMs = ((now - publishedAt) / frames).toFixed(2);
    canvas.dataset.renderCpuMs = (cpuTime / frames).toFixed(2);
    canvas.dataset.drawCalls = String(engine._drawCalls.current);
    canvas.dataset.activeTriangles = String(scene.getActiveIndices() / 3);
    const gpu = engine.gpuTimeInFrameForMainPass?.counter;
    canvas.dataset.gpuMainPassMs = gpu?.count ? (gpu.current / 1e6).toFixed(2) : 'unavailable';
    publishedAt = now;
    frames = cpuTime = 0;
  };
}
