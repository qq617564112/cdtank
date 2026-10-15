import {Camera, Scene, Texture, Vector3} from '@babylonjs/core';
import {packEffectColor} from '../common/effect-color';
import {EffectRenderPass, EffectSpriteMesh} from '../common/effect-sprite-mesh';
import type {EffectColor, EffectVec3} from '../common/types';

export const SHOT_IMPACT_SMOKE = 'Data/effect/effect/yan1.webp?shot-impact';
export const SHOT_IMPACT_FLASH = 'Data/effect/effect/gongji1.webp?shot-impact';

interface ImpactBurst {
  origin: EffectVec3;
  damaging: boolean;
  age: number;
  angle: number;
}

function impactPass(additive: boolean): EffectRenderPass {
  return {states: Object.entries({FVF: 'XYZ|DIFFUSE|TEX1', Lighting: 'FALSE',
    AlphaTestEnable: 'FALSE', AlphaBlendEnable: 'TRUE', SrcBlend: 'SRCALPHA',
    DestBlend: additive ? 'ONE' : 'INVSRCALPHA', ZWriteEnable: 'FALSE', ZEnable: 'TRUE', CullMode: 'NONE',
    'ColorOp[0]': 'MODULATE', 'ColorArg1[0]': 'TEXTURE', 'ColorArg2[0]': 'DIFFUSE',
    'AlphaOp[0]': 'MODULATE', 'AlphaArg1[0]': 'TEXTURE', 'AlphaArg2[0]': 'DIFFUSE',
    'MinFilter[0]': 'LINEAR', 'MagFilter[0]': 'LINEAR', 'AddressU[0]': 'WRAP', 'AddressV[0]': 'WRAP',
  }).map(([name, value]) => ({name, value}))};
}

/** Short, stationary contact cues; native coordinates and camera-facing quads. */
export class ShotImpactRenderer {
  private readonly smoke: EffectSpriteMesh;
  private readonly flash: EffectSpriteMesh;
  private readonly bursts: ImpactBurst[] = [];
  private nextBurst = 0;
  private readonly towardCamera = new Vector3();
  private readonly origin: EffectVec3 = [0, 0, 0];
  private readonly position: EffectVec3 = [0, 0, 0];
  private readonly color: EffectColor = [1, 1, 1, 0];
  private readonly uv = [0, 0, 1, 1] as const;

  constructor(scene: Scene, private readonly camera: Camera, smoke: Texture, flash: Texture,
    private readonly smokePuffCount = 3) {
    this.smoke = new EffectSpriteMesh(scene, impactPass(false), smoke, true);
    this.flash = new EffectSpriteMesh(scene, impactPass(true), flash, true);
    this.clear();
  }

  /** Prepare both materials before the first brief impact arrives. */
  async prepare(): Promise<void> {
    for (const renderer of [this.smoke, this.flash]) {
      renderer.beginBillboards();
      renderer.billboardQuad([0, 0, 0], 1, 0, [0, 0, 1, 1], 0);
      renderer.endBillboards();
      renderer.mesh.setEnabled(false);
      await renderer.material.forceCompilationAsync(renderer.mesh);
    }
  }

  spawn(origin: EffectVec3, damaging: boolean): void {
    this.bursts.push({origin: [...origin], damaging, age: 0, angle: this.nextBurst++ * 137.5 % 360});
  }

  update(deltaSeconds: number, drawOrder: number): void {
    this.smoke.beginBillboards();
    this.flash.beginBillboards();
    for (let index = this.bursts.length - 1; index >= 0; index--) {
      const burst = this.bursts[index];
      burst.age += deltaSeconds;
      const lifetime = burst.damaging ? 0.42 : 0.9;
      if (burst.age >= lifetime) {this.bursts.splice(index, 1); continue;}
      // Move the billboard slightly off the contact surface to avoid clipping.
      const towardCamera = this.camera.globalPosition.subtractFromFloatsToRef(
        -burst.origin[0], burst.origin[1], burst.origin[2], this.towardCamera).normalize().scaleInPlace(2);
      const origin = this.origin;
      origin[0] = burst.origin[0] - towardCamera.x;
      origin[1] = burst.origin[1] + towardCamera.y;
      origin[2] = burst.origin[2] + towardCamera.z;
      if (burst.damaging) {
        const progress = burst.age / lifetime;
        const pop = Math.min(1, burst.age / 0.05);
        const size = 24 + 16 * pop + 5 * progress;
        const fade = Math.max(0, burst.age - 0.09) / (lifetime - 0.09);
        const alpha = Math.min(1, burst.age / 0.018) * (1 - fade) ** 1.2 * 0.9;
        this.color[3] = alpha;
        this.flash.billboardQuad(origin, size, burst.angle, this.uv, packEffectColor(this.color));
        continue;
      }
      for (let puff = 0; puff < this.smokePuffCount; puff++) {
        const age = burst.age - puff * 0.04;
        if (age < 0) continue;
        const progress = age / (lifetime - puff * 0.04);
        const expansion = 1 - (1 - progress) ** 3;
        const angle = (burst.angle + puff * 120) * Math.PI / 180;
        const spread = puff === 0 ? 0 : 6 + expansion * 10;
        const position = this.position;
        position[0] = origin[0] + Math.cos(angle) * spread;
        position[1] = origin[1] + progress * 10;
        position[2] = origin[2] + Math.sin(angle) * spread;
        const size = (puff === 0 ? 20 : 11) + expansion * (puff === 0 ? 13 : 9);
        const fade = Math.max(0, age - 0.12) / (lifetime - puff * 0.04 - 0.12);
        const alpha = Math.min(1, age / 0.04) * (1 - fade) ** 1.35 * (puff === 0 ? 0.78 : 0.4);
        this.color[3] = alpha;
        this.smoke.billboardQuad(position, size, burst.angle + puff * 53, this.uv, packEffectColor(this.color));
      }
    }
    this.smoke.endBillboards();
    this.flash.endBillboards();
    this.smoke.mesh.alphaIndex = drawOrder;
    this.flash.mesh.alphaIndex = drawOrder + 1;
  }

  clear(): void {
    this.bursts.length = 0;
    this.smoke.clear();
    this.flash.clear();
  }

  dispose(): void {
    this.clear();
    this.smoke.dispose();
    this.flash.dispose();
  }
}
