import {Material, ShaderStore, SubMesh, VertexBuffer, type Mesh, type Scene} from '@babylonjs/core';
import type {_InstancesBatch} from '@babylonjs/core/Meshes/mesh';
import {OutlineRenderer} from '@babylonjs/core/Rendering/outlineRenderer';
import {AddClipPlaneUniforms, PrepareStringDefinesForClipPlanes} from '@babylonjs/core/Materials/clipPlaneMaterialHelper';
import {PushAttributesForInstances} from '@babylonjs/core/Materials/materialHelper.functions';
import {outlineVertexShader} from '@babylonjs/core/Shaders/outline.vertex';
import '@babylonjs/core/Shaders/outline.fragment';
import {outlineVertexShaderWGSL} from '@babylonjs/core/ShadersWGSL/outline.vertex';
import '@babylonjs/core/ShadersWGSL/outline.fragment';

const OUTLINE_NORMAL = 'outlineNormal';
const ALPHA_TEST = 1;
const UV1 = 1 << 1;
const UV2 = 1 << 2;
const LOGARITHMIC_DEPTH = 1 << 3;
const CLIP_PLANE_BIT_OFFSET = 4;
const INSTANCES = 1 << 10;
const THIN_INSTANCES = 1 << 11;
const CLIP_PLANE_FIELDS = ['clipPlane', 'clipPlane2', 'clipPlane3', 'clipPlane4', 'clipPlane5', 'clipPlane6'] as const;

ShaderStore.ShadersStore.cartoonOutlineVertexShader = outlineVertexShader.shader
  .replace('attribute vec3 normal;', `attribute vec3 normal;attribute vec3 ${OUTLINE_NORMAL};`)
  .replace('normalUpdated*offset', `${OUTLINE_NORMAL}*offset`);
ShaderStore.ShadersStoreWGSL.cartoonOutlineVertexShader = outlineVertexShaderWGSL.shader
  .replace('attribute normal: vec3f;', `attribute normal: vec3f;attribute ${OUTLINE_NORMAL}: vec3f;`)
  .replace('normalUpdated*uniforms.offset', `vertexInputs.${OUTLINE_NORMAL}*uniforms.offset`);

/** Static hard edges share extrusion directions while retaining their lighting normals. */
class CartoonOutlineRenderer extends OutlineRenderer {
  private readonly definesByFlags = new Map<number, string>();

  constructor(scene: Scene) {
    super(scene);
    // Extrusion supplies the silhouette depth. A negative screen-space bias can
    // cover adjacent actor parts as their projected size decreases.
    this.zOffset = 0;
    this.zOffsetUnits = 0;
  }

  override render(subMesh: SubMesh, batch: _InstancesBatch, useOverlay = false, renderPassId?: number): void {
    const material = subMesh.getMaterial();
    if (!material) return;
    const owner = subMesh.getMesh();
    const renderingMesh = subMesh.getRenderingMesh();
    const effectiveMesh = owner._internalAbstractMeshDataInfo._actAsRegularMesh ? owner : renderingMesh;
    let reverseSide = material._getEffectiveOrientation(renderingMesh) === Material.ClockWiseSideOrientation;
    if (effectiveMesh._getWorldMatrixDeterminant() < 0) reverseSide = !reverseSide;
    // The color outline runs before Mesh.render binds this material's culling
    // state. Double-sided accessories must not inherit the preceding actor's cull.
    this.scene.getEngine().setState(material.backFaceCulling, 0, false, reverseSide,
      this.scene._mirroredCameraPosition ? !material.cullBackFaces : material.cullBackFaces, material.stencil, 0);
    super.render(subMesh, batch, useOverlay, renderPassId);
  }

  override isReady(subMesh: SubMesh, useInstances: boolean, renderPassId?: number): boolean {
    const mesh = subMesh.getRenderingMesh();
    if (!mesh.isVerticesDataPresent(OUTLINE_NORMAL)) return super.isReady(subMesh, useInstances, renderPassId);
    const material = subMesh.getMaterial();
    if (!material) return false;
    let flags = 0;
    if (material.needAlphaTestingForMesh(subMesh.getMesh())) {
      flags |= ALPHA_TEST;
      if (mesh.isVerticesDataPresent(VertexBuffer.UVKind)) flags |= UV1;
      if (mesh.isVerticesDataPresent(VertexBuffer.UV2Kind)) flags |= UV2;
    }
    if (material.useLogarithmicDepth) flags |= LOGARITHMIC_DEPTH;
    for (let index = 0; index < CLIP_PLANE_FIELDS.length; index++) {
      const field = CLIP_PLANE_FIELDS[index];
      if (material[field] ?? this.scene[field]) flags |= 1 << (CLIP_PLANE_BIT_OFFSET + index);
    }
    if (useInstances) {
      flags |= INSTANCES;
      if (mesh.hasThinInstances) flags |= THIN_INSTANCES;
    }
    let joined = this.definesByFlags.get(flags);
    if (joined === undefined) {
      const defines = ['#define CARTOON_OUTLINE', '#define NUM_BONE_INFLUENCERS 0'];
      if (flags & ALPHA_TEST) defines.push('#define ALPHATEST');
      if (flags & UV1) defines.push('#define UV1');
      if (flags & UV2) defines.push('#define UV2');
      if (flags & LOGARITHMIC_DEPTH) defines.push('#define LOGARITHMICDEPTH');
      PrepareStringDefinesForClipPlanes(material, this.scene, defines);
      if (flags & INSTANCES) defines.push('#define INSTANCES');
      if (flags & THIN_INSTANCES) defines.push('#define THIN_INSTANCES');
      joined = defines.join('\n');
      this.definesByFlags.set(flags, joined);
    }
    const drawWrapper = subMesh._getDrawWrapper(renderPassId, true)!;
    if (drawWrapper.defines !== joined) {
      const attributes = [VertexBuffer.PositionKind, VertexBuffer.NormalKind, OUTLINE_NORMAL];
      if (flags & UV1) attributes.push(VertexBuffer.UVKind);
      if (flags & UV2) attributes.push(VertexBuffer.UV2Kind);
      if (flags & INSTANCES) PushAttributesForInstances(attributes);
      const uniforms = ['world', 'viewProjection', 'diffuseMatrix', 'offset', 'color', 'logarithmicDepthConstant'];
      AddClipPlaneUniforms(uniforms);
      drawWrapper.setEffect(this.scene.getEngine().createEffect({vertex: 'cartoonOutline', fragment: 'outline'}, {
        attributes, uniformsNames: uniforms, uniformBuffersNames: [], samplers: ['diffuseSampler'],
        defines: joined, shaderLanguage: this.shaderLanguage, indexParameters: {maxSimultaneousMorphTargets: 0},
        fallbacks: null, onCompiled: null, onError: null,
      }, this.scene.getEngine()), joined);
    }
    return drawWrapper.effect?.isReady() ?? false;
  }

  override dispose(): void {
    this.definesByFlags.clear();
    super.dispose();
  }
}

/** Install before render targets can lazily create Babylon's default renderer. */
export function initializeCartoonOutlineRenderer(scene: Scene): void {
  if (!scene._outlineRenderer) scene._outlineRenderer = new CartoonOutlineRenderer(scene);
}

/** Eligible static meshes upload the asset's shared precomputed extrusion stream. */
export function prepareCartoonOutlineMesh(mesh: Mesh): void {
  initializeCartoonOutlineRenderer(mesh.getScene());
  if (mesh.morphTargetManager || mesh.skeleton || mesh.bakedVertexAnimationManager?.isEnabled
    || mesh.isVerticesDataPresent(OUTLINE_NORMAL)) return;
  const normals = mesh._internalMetadata?.cdtankOutlineNormals as Float32Array | undefined;
  if (normals) mesh.setVerticesData(OUTLINE_NORMAL, normals, false, 3);
}
