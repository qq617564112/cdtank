/// <reference types="vite/client" />
import {WebGPUEngine} from '@babylonjs/core';
import {getDisplayPreferences} from '../interface/settings/display-preferences';
import glslangScript from '@babylonjs/core/assets/glslang/glslang.js?url';
import glslangWasm from '@babylonjs/core/assets/glslang/glslang.wasm?url';
import twgslScript from '@babylonjs/core/assets/twgsl/twgsl.js?url';
import twgslWasm from '@babylonjs/core/assets/twgsl/twgsl.wasm?url';

/** All viewports require WebGPU and load shader compilers from the application. */
export async function createWebGpuEngine(canvas: HTMLCanvasElement, transparent = false): Promise<WebGPUEngine> {
  if (!('gpu' in navigator)) {
    throw new Error('当前浏览器无法使用 WebGPU，请使用支持 WebGPU 的浏览器，并通过 HTTPS 或 localhost 打开游戏。');
  }
  const engine = new WebGPUEngine(canvas, {
    antialias: getDisplayPreferences().msaa4x, stencil: true, adaptToDeviceRatio: true,
    premultipliedAlpha: transparent, powerPreference: 'high-performance',
    deviceDescriptor: {requiredFeatures: ['timestamp-query']},
    glslangOptions: {jsPath: glslangScript, wasmPath: glslangWasm},
    twgslOptions: {jsPath: twgslScript, wasmPath: twgslWasm},
  });
  try {
    await engine.initAsync();
    // Rebind buffers each frame as scene instances grow during loading.
    engine.compatibilityMode = true;
    engine.enableGPUTimingMeasurements = !!engine.getCaps().timerQuery;
    canvas.dataset.renderer = 'webgpu';
    return engine;
  } catch (error) {
    // Babylon's dispose assumes device resources exist, even if initAsync failed before creating them.
    try {engine.dispose();} catch {}
    throw new Error(`WebGPU 初始化失败：${error instanceof Error ? error.message : String(error)}`, {cause: error});
  }
}
