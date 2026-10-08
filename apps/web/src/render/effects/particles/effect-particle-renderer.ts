import {Camera, Scene, Texture} from '@babylonjs/core';
import {packEffectColor} from '../common/effect-color';
import {EffectParticleState} from './effect-particle-state';
import {EffectRenderPass, EffectSpriteMesh} from '../common/effect-sprite-mesh';

/** Native type-6 scalar half-size, angle Z, UV frames and ascending draw order. */
export class EffectParticleRenderer {
  readonly sprite: EffectSpriteMesh;

  constructor(scene: Scene, pass: EffectRenderPass, texture: Texture,
    private readonly frames: readonly [number, number, number, number][]) {
    this.sprite = new EffectSpriteMesh(scene, pass, texture, true);
  }

  update(_camera: Camera, particles: readonly EffectParticleState[]): void {
    this.sprite.beginBillboards();
    for (const particle of particles) {
      if (!particle.visible) continue;
      this.sprite.billboardQuad(particle.position, particle.scale, particle.angles[2],
        this.frames[particle.frame], packEffectColor(particle.color));
    }
    this.sprite.endBillboards();
  }

  dispose(): void {
    this.sprite.dispose();
  }
}
