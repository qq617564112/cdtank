import {Camera, Scene, Texture} from '@babylonjs/core';
import {effectCameraCorners, effectCameraUv} from '../camera/effect-camera';
import {packEffectColor} from '../common/effect-color';
import {EffectParticleState} from './effect-particle-state';
import {EffectRenderPass, EffectSpriteMesh} from '../common/effect-sprite-mesh';

/** Native type-6 scalar half-size, angle Z, UV frames and ascending draw order. */
export class EffectParticleRenderer {
  readonly sprite: EffectSpriteMesh;

  constructor(scene: Scene, pass: EffectRenderPass, texture: Texture,
    private readonly frames: readonly [number, number, number, number][]) {
    this.sprite = new EffectSpriteMesh(scene, pass, texture);
  }

  update(camera: Camera, particles: readonly EffectParticleState[]): void {
    this.sprite.updateQuads(particles.filter(particle => particle.visible).map(particle => ({
      corners: effectCameraCorners(camera, particle.position,
        [particle.scale, particle.scale, 0], particle.angles[2]),
      uv: effectCameraUv(this.frames[particle.frame]),
      packedColor: packEffectColor(particle.color),
    })));
  }

  dispose(): void {
    this.sprite.dispose();
  }
}
