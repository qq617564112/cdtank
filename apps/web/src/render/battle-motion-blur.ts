import {Constants, PostProcess, ShaderLanguage, ShaderStore, Texture, Vector3,
  type AbstractMesh, type ArcRotateCamera, type Scene, type SubMesh, type TransformNode} from '@babylonjs/core';
import {GeometryBufferRenderer} from '@babylonjs/core/Rendering/geometryBufferRenderer';
import {battleMotionBlurFragment} from './battle-motion-blur-shader';

const clearPlayers = new WeakMap<Scene, TransformNode>();
/** Velocity and the player mask cover half the world resolution on each axis. */
const VELOCITY_SCALE = .5;
ShaderStore.ShadersStoreWGSL.battleMotionBlurPixelShader = battleMotionBlurFragment;

/** Keep every action and cosmetic under the local tank root clear through effect rebuilds. */
export function setMotionBlurPlayer(scene: Scene, root?: TransformNode): void {
  if (root) clearPlayers.set(scene, root);
  else clearPlayers.delete(scene);
}

/** A newly visible action starts its velocity history at its current pose. */
class BattleVelocityBuffer extends GeometryBufferRenderer {
  private readonly renderedFrames = new WeakMap<AbstractMesh, number>();

  override isReady(subMesh: SubMesh, useInstances: boolean): boolean {
    if (!super.isReady(subMesh, useInstances)) return false;
    const mesh = subMesh.getEffectiveMesh();
    const frame = this.scene.getFrameId();
    const previousFrame = this.renderedFrames.get(mesh);
    if (previousFrame !== frame && previousFrame !== frame - 1) {
      const previous = this._previousTransformationMatrices[mesh.uniqueId];
      if (previous) {
        previous.world.copyFrom(mesh.getWorldMatrix());
        previous.viewProjection.copyFrom(this.scene.getTransformMatrix());
      }
    }
    this.renderedFrames.set(mesh, frame);
    return true;
  }
}

/** Native WGSL motion vectors and a depth-tested player mask share one geometry pass. */
export class BattleMotionBlur {
  readonly postProcess: PostProcess;
  private readonly velocity;
  private readonly removedMesh;
  private readonly previousPosition = Vector3.Zero();
  private readonly previousForward = Vector3.Zero();
  private readonly forward = Vector3.Zero();
  private previousFrameAt = 0;

  constructor(private readonly scene: Scene, private readonly camera: ArcRotateCamera,
    private readonly renderScale: number) {
    this.velocity = new BattleVelocityBuffer(scene, renderScale * VELOCITY_SCALE, Constants.TEXTUREFORMAT_DEPTH16, {
      [GeometryBufferRenderer.VELOCITY_LINEAR_TEXTURE_TYPE]: {
        textureType: Constants.TEXTURETYPE_HALF_FLOAT, textureFormat: Constants.TEXTUREFORMAT_RG,
        samplingMode: Texture.NEAREST_SAMPLINGMODE,
      },
    });
    this.velocity.enableVelocityLinear = true;
    this.velocity.enableMeshBlendingTag = true;
    this.velocity.enableNormal = false;
    this.velocity.enableDepth = false;
    this.velocity.meshBlendTagProvider = mesh => {
      const player = clearPlayers.get(scene);
      return player && mesh.isDescendantOf(player) ? 0 : 1;
    };
    scene.geometryBufferRenderer = this.velocity;
    const buffer = this.velocity.getGBuffer();
    buffer.activeCamera = camera;
    this.removedMesh = scene.onMeshRemovedObservable.add(mesh => {
      delete this.velocity._previousTransformationMatrices[mesh.uniqueId];
      delete this.velocity._previousBonesTransformationMatrices[mesh.uniqueId];
    });
    this.postProcess = new PostProcess('battle-motion-blur', 'battleMotionBlur', {
      camera, size: renderScale, samplingMode: Texture.BILINEAR_SAMPLINGMODE,
      shaderLanguage: ShaderLanguage.WGSL,
      uniforms: ['motionStrength', 'screenSize'], samplers: ['velocitySampler', 'playerMaskSampler'],
    });
    this.postProcess.onApplyObservable.add(effect => {
      const now = performance.now();
      camera.getTarget().subtractToRef(camera.position, this.forward).normalize();
      const cameraCut = Vector3.DistanceSquared(camera.position, this.previousPosition) > camera.radius ** 2
        || Vector3.Dot(this.forward, this.previousForward) < Math.SQRT1_2;
      const skip = !this.previousFrameAt || now - this.previousFrameAt > 100 || cameraCut;
      const ratio = Math.max(scene.getAnimationRatio(), .01);
      effect.setFloat('motionStrength', skip ? 0 : .5 / ratio);
      effect.setFloat2('screenSize', this.postProcess.width, this.postProcess.height);
      effect.setTexture('velocitySampler', buffer.textures[
        this.velocity.getTextureIndex(GeometryBufferRenderer.VELOCITY_LINEAR_TEXTURE_TYPE)]);
      effect.setTexture('playerMaskSampler', buffer.textures[
        this.velocity.getTextureIndex(GeometryBufferRenderer.MESH_BLEND_TAG_TEXTURE_TYPE)]);
      this.previousFrameAt = now;
      this.previousPosition.copyFrom(camera.position);
      this.previousForward.copyFrom(this.forward);
    });
    this.resize();
  }

  resize(): void {
    const engine = this.scene.getEngine();
    const width = Math.max(1, Math.floor(engine.getRenderWidth() * this.renderScale * VELOCITY_SCALE));
    const height = Math.max(1, Math.floor(engine.getRenderHeight() * this.renderScale * VELOCITY_SCALE));
    const buffer = this.velocity.getGBuffer();
    const size = buffer.getSize();
    if (size.width !== width || size.height !== height) buffer.resize({width, height});
    this.previousFrameAt = 0;
  }

  dispose(): void {
    this.postProcess.dispose(this.camera);
    this.scene.onMeshRemovedObservable.remove(this.removedMesh);
    this.scene.disableGeometryBufferRenderer();
  }
}
