import {Camera, Scene, Texture, Vector3} from '@babylonjs/core';
import {packEffectColor} from '../common/effect-color';
import {EffectRenderPass, EffectSpriteMesh} from '../common/effect-sprite-mesh';
import type {EffectVec3} from '../common/types';

export const SHOT_IMPACT_SMOKE = 'Data/effect/effect/yan1.png?shot-impact';
export const SHOT_IMPACT_FLASH = 'Data/effect/effect/gongji1.png?shot-impact';

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

  constructor(scene: Scene, private readonly camera: Camera, smoke: Texture, flash: Texture) {
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
      const towardCamera = this.camera.globalPosition.subtract(
        new Vector3(-burst.origin[0], burst.origin[1], burst.origin[2])).normalize().scale(2);
      const origin: EffectVec3 = [burst.origin[0] - towardCamera.x,
        burst.origin[1] + towardCamera.y, burst.origin[2] + towardCamera.z];
      if (burst.damaging) {
        const progress = burst.age / lifetime;
        const pop = Math.min(1, burst.age / 0.05);
        const size = 24 + 16 * pop + 5 * progress;
        const fade = Math.max(0, burst.age - 0.09) / (lifetime - 0.09);
        const alpha = Math.min(1, burst.age / 0.018) * (1 - fade) ** 1.2 * 0.9;
        this.flash.billboardQuad(origin, size, burst.angle, [0, 0, 1, 1],
          packEffectColor([1, 1, 1, alpha]));
        continue;
      }
      for (let puff = 0; puff < 3; puff++) {
        const age = burst.age - puff * 0.04;
        if (age < 0) continue;
        const progress = age / (lifetime - puff * 0.04);
        const expansion = 1 - (1 - progress) ** 3;
        const angle = (burst.angle + puff * 120) * Math.PI / 180;
        const spread = puff === 0 ? 0 : 6 + expansion * 10;
        const position: EffectVec3 = [origin[0] + Math.cos(angle) * spread,
          origin[1] + progress * 10, origin[2] + Math.sin(angle) * spread];
        const size = (puff === 0 ? 20 : 11) + expansion * (puff === 0 ? 13 : 9);
        const fade = Math.max(0, age - 0.12) / (lifetime - puff * 0.04 - 0.12);
        const alpha = Math.min(1, age / 0.04) * (1 - fade) ** 1.35 * (puff === 0 ? 0.78 : 0.4);
        this.smoke.billboardQuad(position, size, burst.angle + puff * 53, [0, 0, 1, 1],
          packEffectColor([1, 1, 1, alpha]));
      }
    }
    this.smoke.endBillboards();
    this.flash.endBillboards();
    this.smoke.mesh.alphaIndex = drawOrder;
    this.flash.mesh.alphaIndex = drawOrder + 1;
  }

  clear(): void {
    this.bursts.length = 0;
    this.smoke.mesh.setEnabled(false);
    this.flash.mesh.setEnabled(false);
  }

  dispose(): void {
    this.clear();
    this.smoke.dispose();
    this.flash.dispose();
  }
}
