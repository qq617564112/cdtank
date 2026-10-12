import {Mesh, ShaderStore, SubMesh, VertexBuffer} from '@babylonjs/core';
import {OutlineRenderer} from '@babylonjs/core/Rendering/outlineRenderer';
import {AddClipPlaneUniforms, PrepareStringDefinesForClipPlanes} from '@babylonjs/core/Materials/clipPlaneMaterialHelper';
import {PushAttributesForInstances} from '@babylonjs/core/Materials/materialHelper.functions';
import {outlineVertexShader} from '@babylonjs/core/Shaders/outline.vertex';
import '@babylonjs/core/Shaders/outline.fragment';
import {outlineVertexShaderWGSL} from '@babylonjs/core/ShadersWGSL/outline.vertex';
import '@babylonjs/core/ShadersWGSL/outline.fragment';

const OUTLINE_NORMAL = 'outlineNormal';
const POSITION_PRECISION = 10000;

ShaderStore.ShadersStore.cartoonOutlineVertexShader = outlineVertexShader.shader
  .replace('attribute vec3 normal;', `attribute vec3 normal;attribute vec3 ${OUTLINE_NORMAL};`)
  .replace('normalUpdated*offset', `${OUTLINE_NORMAL}*offset`);
ShaderStore.ShadersStoreWGSL.cartoonOutlineVertexShader = outlineVertexShaderWGSL.shader
  .replace('attribute normal: vec3f;', `attribute normal: vec3f;attribute ${OUTLINE_NORMAL}: vec3f;`)
  .replace('normalUpdated*uniforms.offset', `vertexInputs.${OUTLINE_NORMAL}*uniforms.offset`);

/** Static hard edges share extrusion directions while retaining their lighting normals. */
class CartoonOutlineRenderer extends OutlineRenderer {
  override isReady(subMesh: SubMesh, useInstances: boolean, renderPassId?: number): boolean {
    const mesh = subMesh.getRenderingMesh();
    if (!mesh.isVerticesDataPresent(OUTLINE_NORMAL)) return super.isReady(subMesh, useInstances, renderPassId);
    const material = subMesh.getMaterial();
    if (!material) return false;
    const attributes = [VertexBuffer.PositionKind, VertexBuffer.NormalKind, OUTLINE_NORMAL];
    const defines = ['#define CARTOON_OUTLINE', '#define NUM_BONE_INFLUENCERS 0'];
    if (material.needAlphaTestingForMesh(subMesh.getMesh())) {
      defines.push('#define ALPHATEST');
      for (const [kind, define] of [[VertexBuffer.UVKind, 'UV1'], [VertexBuffer.UV2Kind, 'UV2']]) {
        if (!mesh.isVerticesDataPresent(kind)) continue;
        attributes.push(kind);
        defines.push(`#define ${define}`);
      }
    }
    if (material.useLogarithmicDepth) defines.push('#define LOGARITHMICDEPTH');
    PrepareStringDefinesForClipPlanes(material, this.scene, defines);
    if (useInstances) {
      defines.push('#define INSTANCES');
      PushAttributesForInstances(attributes);
      if (mesh.hasThinInstances) defines.push('#define THIN_INSTANCES');
    }
    const drawWrapper = subMesh._getDrawWrapper(renderPassId, true)!;
    const joined = defines.join('\n');
    if (drawWrapper.defines !== joined) {
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
}

/** One shared vertex stream per static geometry; instances use the same outline draw passes. */
export function prepareCartoonOutlineMesh(mesh: Mesh): void {
  const scene = mesh.getScene();
  if (!scene._outlineRenderer) scene._outlineRenderer = new CartoonOutlineRenderer(scene);
  if (mesh.morphTargetManager || mesh.skeleton || mesh.bakedVertexAnimationManager?.isEnabled
    || mesh.isVerticesDataPresent(OUTLINE_NORMAL)) return;
  const positions = mesh.getVerticesData(VertexBuffer.PositionKind);
  const normals = mesh.getVerticesData(VertexBuffer.NormalKind);
  if (!positions || !normals) return;
  const groups = new Map<string, {x: number; y: number; z: number}>();
  const keys: string[] = [];
  for (let index = 0; index < positions.length; index += 3) {
    const key = [0, 1, 2].map(axis => Math.round(positions[index + axis] * POSITION_PRECISION)).join(',');
    keys.push(key);
    let group = groups.get(key);
    if (!group) {
      group = {x: 0, y: 0, z: 0};
      groups.set(key, group);
    }
    group.x += normals[index];
    group.y += normals[index + 1];
    group.z += normals[index + 2];
  }
  const outlineNormals = new Float32Array(normals.length);
  for (let vertex = 0; vertex < keys.length; vertex++) {
    const group = groups.get(keys[vertex])!;
    const length = Math.hypot(group.x, group.y, group.z);
    if (!length) continue;
    outlineNormals[vertex * 3] = group.x / length;
    outlineNormals[vertex * 3 + 1] = group.y / length;
    outlineNormals[vertex * 3 + 2] = group.z / length;
  }
  mesh.setVerticesData(OUTLINE_NORMAL, outlineNormals, false, 3);
}
