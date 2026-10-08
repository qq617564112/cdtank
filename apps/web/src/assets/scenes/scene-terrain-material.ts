import {AssetContainer, PBRMaterial, ShaderMaterial} from '@babylonjs/core';
import {FIELD_ROAD_HD} from '../../../../shared/maps/field-road-hd';
import {
  bindSceneEnvironmentIfPresent, SCENE_ENVIRONMENT_FRAGMENT_APPLY,
  SCENE_ENVIRONMENT_FRAGMENT_DECLARATION, SCENE_ENVIRONMENT_UNIFORMS,
  SCENE_ENVIRONMENT_VERTEX_DECLARATION,
} from '../../render/scene-environment';
import {applyDeviceState, resolveDeviceState} from '../../render/scene-device-state';

interface TerrainPart {
  mesh: string;
  kind: number;
  shader: string;
  texture?: string;
  occurrence?: number;
}

export function hasSceneTerrainMaterial(mapId: string): boolean {
  return /^(000[1-9]|001[0-9]|002[0-5])$/.test(mapId) || mapId === FIELD_ROAD_HD.sceneId;
}

const VERTEX = `${SCENE_ENVIRONMENT_VERTEX_DECLARATION}
attribute vec3 position;
attribute vec2 uv;
attribute vec4 color;
uniform mat4 worldViewProjection;
uniform mat4 world;
varying vec2 sourceUv;
varying vec4 sourceDiffuse;
void main() {
  sourceUv = uv;
  sourceDiffuse = color;
  vec4 worldPosition = world * vec4(position, 1.0);
  // Terrain source GBF is unlit geom_c1; keep texture × packed diffuse and
  // only add the scene fog term.
  sceneLitColor = vec3(1.0);
  sceneFogFactor = sceneFog(worldPosition.xyz);
  gl_Position = worldViewProjection * vec4(position, 1.0);
}`;

const FRAGMENT = `${SCENE_ENVIRONMENT_FRAGMENT_DECLARATION}
#ifdef SOURCE_TEXTURE
uniform sampler2D sourceTexture;
#endif
uniform float sourceAlphaRef;
varying vec2 sourceUv;
varying vec4 sourceDiffuse;
void main() {
#ifdef SOURCE_TEXTURE
  vec4 result = texture2D(sourceTexture, sourceUv) * sourceDiffuse;
#else
  vec4 result = sourceDiffuse;
#endif
#ifdef SOURCE_ALPHA_TEST
  if (result.a <= sourceAlphaRef) discard;
#endif
  gl_FragColor = result;
${SCENE_ENVIRONMENT_FRAGMENT_APPLY}
}`;

/** Original terrain texture × packed diffuse, independent of scene lighting. */
export class SceneTerrainMaterial {
  private readonly replacements: {
    mesh: AssetContainer['meshes'][number];
    original: PBRMaterial;
    material: ShaderMaterial;
  }[] = [];
  private disposed = false;

  async load(mapId: string, terrain: AssetContainer): Promise<void> {
    if (!hasSceneTerrainMaterial(mapId)) return;
    const response = await fetch(`/scene-terrain-material-${mapId}.json`);
    if (!response.ok) throw new Error('原地形材质合同载入失败');
    const resource = await response.json() as {mapId: number; parts: TerrainPart[]};
    if (this.disposed) return;
    if (resource.mapId !== Number(mapId)) throw new Error('原地形材质地图身份不符');
    // GLB nodes retain source order, including repeated native mesh names.
    const meshesByName = new Map<string, AssetContainer['meshes']>();
    for (const mesh of terrain.meshes) {
      const meshes = meshesByName.get(mesh.name) ?? [];
      meshes.push(mesh);
      meshesByName.set(mesh.name, meshes);
    }
    for (const part of resource.parts) {
      const mesh = meshesByName.get(part.mesh)?.[part.occurrence ?? 0];
      if (!mesh || !(mesh.material instanceof PBRMaterial) ||
        (!mesh.material.albedoTexture && part.texture !== '')) {
        throw new Error(`原地形材质缺少模型或纹理：${part.mesh}`);
      }
      const original = mesh.material;
      const transparent = part.kind === 1;
      const material = new ShaderMaterial(`terrain${String(resource.mapId).padStart(2, '0')}/${part.mesh}`, terrain.scene,
        {vertexSource: VERTEX, fragmentSource: FRAGMENT}, {
          attributes: ['position', 'uv', 'color'],
          uniforms: ['world', 'worldViewProjection', 'sourceAlphaRef', ...SCENE_ENVIRONMENT_UNIFORMS],
          samplers: original.albedoTexture ? ['sourceTexture'] : [],
          defines: [...(original.albedoTexture ? ['SOURCE_TEXTURE'] : []),
            ...(transparent ? ['SOURCE_ALPHA_TEST'] : [])],
          needAlphaBlending: transparent, needAlphaTesting: transparent,
        });
      if (original.albedoTexture) material.setTexture('sourceTexture', original.albedoTexture);
      // Terrain source GBFs are unlit geom_c1; only fog is added here.
      bindSceneEnvironmentIfPresent(material, terrain.scene);
      // default.gbf baseline overlaid with the selected geom_c1/geom_t_c1
      // pass; POL vertex RGBA does not put an opaque kind into the alpha queue.
      applyDeviceState(material, resolveDeviceState({
        cull: original.backFaceCulling ? 'CW' : 'NONE',
        alphaBlend: transparent, alphaTest: transparent, alphaRef: transparent ? 100 : 0,
      }));
      material.metadata = {sourceTerrainShader: part.shader, sourceTerrainKind: part.kind};
      mesh.material = material;
      this.replacements.push({mesh, original, material});
    }
  }

  dispose(): void {
    this.disposed = true;
    for (const {mesh, original, material} of this.replacements) {
      if (!mesh.isDisposed()) mesh.material = original;
      material.dispose(false, false);
    }
    this.replacements.length = 0;
  }
}
