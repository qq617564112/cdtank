export interface HomePreviewOrbit {
  pitch: number;
  yaw: number;
  orbitYaw: number;
}

/** Original455ef1 writes these planes before binding the mode2 camera. */
export const HOME_PREVIEW_CLIP_PLANES = {near: 10, far: 5000} as const;

/** MyTank4e5e22 calls472e01(0,float32(0.0075)) once per page update. */
export function advanceHomePreviewOrbit(state: HomePreviewOrbit): void {
  state.pitch = Math.fround(state.pitch);
  state.yaw = Math.fround(state.yaw + Math.fround(0.0075));
  state.orbitYaw = Math.fround(state.orbitYaw + Math.fround(0.0075));
}
