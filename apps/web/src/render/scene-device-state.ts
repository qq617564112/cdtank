import {Constants, Material, ShaderMaterial} from '@babylonjs/core';

/**
 * Original D3D device state inheritance.
 *
 * `Data/gfxscript/default.gbf` is applied by `0x10027660`/`0x10020466` and
 * leaves a baseline device state; each selected GBF only overrides the states
 * it names. WebGL has no persistent device state, so the same result is
 * produced per material: the resolved state is `default.gbf` overlaid with the
 * pass overrides. No feature flag or shared global is involved.
 */

export interface SceneDevicePassState {
  readonly cull: 'CW' | 'CCW' | 'NONE';
  readonly depthWrite: boolean;
  readonly depthTest: boolean;
  readonly alphaBlend: boolean;
  readonly alphaTest: boolean;
  readonly alphaRef: number;
  readonly fogEnable: boolean;
  readonly lighting: boolean;
  readonly colorVertex: boolean;
  readonly normalizeNormals: boolean;
}

/** Values taken verbatim from `default.gbf`. */
export const DEFAULT_DEVICE_STATE: SceneDevicePassState = {
  cull: 'CW',
  depthWrite: true,
  depthTest: true,
  alphaBlend: false,
  alphaTest: false,
  alphaRef: 0,
  fogEnable: false,
  lighting: true,
  colorVertex: true,
  normalizeNormals: false,
};

/** Resolve `default.gbf` plus the states a selected pass explicitly sets. */
export function resolveDeviceState(pass: Partial<SceneDevicePassState>): SceneDevicePassState {
  return {...DEFAULT_DEVICE_STATE, ...pass};
}

/**
 * Apply a resolved source state to a custom material. Babylon resets most
 * state per draw, so this only writes the fields the material exposes and
 * keeps opaque/transparent/alpha-test decisions sourced from the GBF rather
 * than from the previous material that happened to draw.
 */
export function applyDeviceState(material: ShaderMaterial,
  state: SceneDevicePassState): void {
  material.backFaceCulling = state.cull !== 'NONE';
  material.sideOrientation = state.cull === 'CCW' ?
    Material.ClockWiseSideOrientation : Material.CounterClockWiseSideOrientation;
  material.disableDepthWrite = !state.depthWrite;
  // Babylon disables depth writes when blending unless the material forces them.
  material.forceDepthWrite = state.depthWrite;
  material.depthFunction = state.depthTest ? Constants.LESS : Constants.ALWAYS;
  material.transparencyMode = state.alphaBlend ? ShaderMaterial.MATERIAL_ALPHATESTANDBLEND :
    state.alphaTest ? ShaderMaterial.MATERIAL_ALPHATEST : ShaderMaterial.MATERIAL_OPAQUE;
  material.alphaMode = state.alphaBlend ? Constants.ALPHA_COMBINE : Constants.ALPHA_DISABLE;
  material.setFloat('sourceAlphaRef', state.alphaRef / 255);
}
