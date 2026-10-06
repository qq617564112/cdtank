import {AbstractMesh, BaseTexture, Constants, PBRMaterial, Scene, ShaderMaterial, Vector4} from '@babylonjs/core';
import '@babylonjs/core/Shaders/ShadersInclude/morphTargetsVertexGlobalDeclaration';
import '@babylonjs/core/Shaders/ShadersInclude/morphTargetsVertexDeclaration';
import '@babylonjs/core/Shaders/ShadersInclude/morphTargetsVertexGlobal';
import '@babylonjs/core/Shaders/ShadersInclude/morphTargetsVertex';

/** Original 1001b6f0 parameter4, ordinary MV3 with no selected lights/fog. */
export function mv3Ambient(properties: readonly number[], opacity = 1,
  ambient: readonly number[] = [0.2, 0.2, 0.2], emissive = 0): number[] {
  if (properties.length !== 17 || ambient.length !== 3) throw new Error('Invalid original MV3 material');
  return [0, 1, 2].map(axis => Math.fround(
    Math.fround(Math.fround(ambient[axis]) * properties[4 + axis]) +
    Math.fround(Math.fround(emissive) * properties[12 + axis]),
  )).concat(Math.fround(Math.fround(opacity) * properties[7]));
}

/** newgeom/geom_t COLOR=ambient, stage0 TEXTURE*CURRENT; normals remain asset data. */
export function createMv3Material(scene: Scene, properties: readonly number[], texture?: BaseTexture,
  opacity = 1): ShaderMaterial {
  const transparent = properties[3] < 1 || opacity < 1;
  const material = new ShaderMaterial('original-mv3-material', scene, {
    vertexSource: `precision highp float;
attribute vec3 position; attribute vec2 uv; uniform mat4 worldViewProjection;
varying vec2 vUV;
#include<morphTargetsVertexGlobalDeclaration>
#include<morphTargetsVertexDeclaration>[0..maxSimultaneousMorphTargets]
void main(){vec3 positionUpdated=position;
#include<morphTargetsVertexGlobal>
#include<morphTargetsVertex>[0..maxSimultaneousMorphTargets]
gl_Position=worldViewProjection*vec4(positionUpdated,1.0);vUV=uv;}`,
    fragmentSource: `precision highp float;
varying vec2 vUV; uniform vec4 sourceAmbient;
${texture ? 'uniform sampler2D sourceTexture;' : ''}
void main(){vec4 color=${texture ? 'texture2D(sourceTexture,vUV)' : 'vec4(1.0)'}*clamp(sourceAmbient,0.0,1.0);
${transparent ? 'if(floor(color.a*255.0+0.5)<=100.0)discard;' : ''}
gl_FragColor=color;}`,
  }, {attributes: ['position', 'uv'], uniforms: ['worldViewProjection', 'sourceAmbient'],
    samplers: texture ? ['sourceTexture'] : [], needAlphaBlending: transparent});
  const ambient = scene.ambientColor.equalsFloats(0, 0, 0)
    ? [0.2, 0.2, 0.2] : scene.ambientColor.asArray();
  material.setVector4('sourceAmbient', Vector4.FromArray(mv3Ambient(properties, opacity, ambient)));
  if (texture) {
    // default.gbf/newgeom/geom_t: LINEAR min/mag, WRAP U/V; no mip filter.
    texture.updateSamplingMode(Constants.TEXTURE_LINEAR_LINEAR);
    texture.wrapU = Constants.TEXTURE_WRAP_ADDRESSMODE;
    texture.wrapV = Constants.TEXTURE_WRAP_ADDRESSMODE;
    material.setTexture('sourceTexture', texture);
  }
  material.backFaceCulling = true;
  material.depthFunction = Constants.LESS;
  material.transparencyMode = transparent ? ShaderMaterial.MATERIAL_ALPHABLEND : ShaderMaterial.MATERIAL_OPAQUE;
  material.alphaMode = transparent ? Constants.ALPHA_COMBINE : Constants.ALPHA_DISABLE;
  material.metadata = {originalMV3: {properties: [...properties], opacity, script: transparent ? 'geom_t' : 'newgeom',
    ambient, scope: 'Source material formula with scene ambient; original actor lighting and fog remain incomplete'}};
  return material;
}

/** Only source-tagged MV3 imports; POL/CVD and effect-specific materials keep their paths. */
export function applyMv3Materials(scene: Scene, meshes: readonly AbstractMesh[],
  textureOverride?: BaseTexture): ShaderMaterial[] {
  const replacements = new Map<PBRMaterial | ShaderMaterial, ShaderMaterial>();
  for (const mesh of meshes) {
    const old = mesh.material;
    if (!(old instanceof PBRMaterial) && !(textureOverride && old instanceof ShaderMaterial)) continue;
    const source = (old instanceof PBRMaterial ? old.metadata?.gltf?.extras?.originalMV3 :
      old.metadata?.originalMV3) as {properties?: number[]; textures?: string[]; opacity?: number} | undefined;
    if (!source?.properties || source.properties.length !== 17) continue;
    const texture = textureOverride ?? (old instanceof PBRMaterial ? old.albedoTexture : undefined);
    // Only an explicitly selected actor texture resolves a nonempty legacy source name.
    if (source.textures?.[0] && !texture) continue;
    let material = replacements.get(old);
    if (!material) {
      material = createMv3Material(scene, source.properties, texture ?? undefined, source.opacity);
      replacements.set(old, material);
    }
    mesh.material = material;
  }
  // Replaced objects no longer render; source and actor textures are borrowed resources.
  for (const old of replacements.keys()) old.dispose(false, false);
  return [...replacements.values()];
}
