import {AssetContainer, Constants, PBRMaterial, ShaderMaterial} from '@babylonjs/core';

interface TerrainPart {
  mesh: string;
  kind: number;
  shader: string;
}

const VERTEX = `precision highp float;
attribute vec3 position;
attribute vec2 uv;
attribute vec4 color;
uniform mat4 worldViewProjection;
varying vec2 sourceUv;
varying vec4 sourceDiffuse;
void main() {
  sourceUv = uv;
  sourceDiffuse = color;
  gl_Position = worldViewProjection * vec4(position, 1.0);
}`;

const FRAGMENT = `precision highp float;
uniform sampler2D sourceTexture;
varying vec2 sourceUv;
varying vec4 sourceDiffuse;
void main() {
  vec4 result = texture2D(sourceTexture, sourceUv) * sourceDiffuse;
#ifdef SOURCE_ALPHA_TEST
  if (result.a <= 100.0 / 255.0) discard;
#endif
  gl_FragColor = result;
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
    if (!['0002', '0004', '0005', '0006', '0007', '0010', '0011', '0014', '0017', '0018', '0020', '0021', '0022'].includes(mapId)) return;
    const response = await fetch(`/scene-terrain-material-${mapId}.json`);
    if (!response.ok) throw new Error('原地形材质合同载入失败');
    const resource = await response.json() as {mapId: number; parts: TerrainPart[]};
    if (this.disposed) return;
    if (resource.mapId !== Number(mapId)) throw new Error('原地形材质地图身份不符');
    for (const part of resource.parts) {
      const mesh = terrain.meshes.find(value => value.name === part.mesh);
      if (!mesh || !(mesh.material instanceof PBRMaterial) || !mesh.material.albedoTexture) {
        throw new Error(`原地形材质缺少模型或纹理：${part.mesh}`);
      }
      const original = mesh.material;
      const transparent = part.kind === 1;
      const material = new ShaderMaterial(`terrain${String(resource.mapId).padStart(2, '0')}/${part.mesh}`, terrain.scene,
        {vertexSource: VERTEX, fragmentSource: FRAGMENT}, {
          attributes: ['position', 'uv', 'color'], uniforms: ['worldViewProjection'],
          samplers: ['sourceTexture'], defines: transparent ? ['SOURCE_ALPHA_TEST'] : [],
          needAlphaBlending: transparent, needAlphaTesting: transparent,
        });
      material.setTexture('sourceTexture', original.albedoTexture!);
      material.alphaMode = Constants.ALPHA_COMBINE;
      material.depthFunction = Constants.LESS;
      material.forceDepthWrite = true;
      // Preserve the existing imported geometry's sidedness in this material slice.
      material.backFaceCulling = original.backFaceCulling;
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
