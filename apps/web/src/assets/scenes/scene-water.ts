import {AssetContainer, LoadAssetContainerAsync, PBRMaterial, Scene, Texture} from '@babylonjs/core';

interface WaterResource {
  mapId: number;
  geometry: {name: 'water'|'waves'; asset: string; opacity: number[]}[];
  textures: {index: number; asset: string}[];
}

/** Original water scrolls texture coordinates; waves cycle 32 caustic textures. */
export class SceneWater {
  private readonly containers: AssetContainer[] = [];
  private readonly textures: Texture[] = [];
  private wave?: AssetContainer;
  private water?: AssetContainer;
  private disposed = false;
  private textureIndex = 0;
  private textureStarted = 0;
  private offset = 0;

  constructor(private readonly scene: Scene) {}

  async load(mapId: string): Promise<void> {
    if (mapId !== '0002') return;
    const response = await fetch('/scene-water-0002.json');
    if (!response.ok) throw new Error('原水面资源载入失败');
    const resource = await response.json() as WaterResource;
    if (this.disposed) return;
    if (resource.mapId !== 2) throw new Error('原水面地图身份不符');
    try {
      for (const entry of resource.geometry) {
        const container = await LoadAssetContainerAsync(`/${entry.asset}`, this.scene);
        if (this.disposed) {container.dispose(); return;}
        this.containers.push(container);
        container.materials.forEach(material => {
          if (material instanceof PBRMaterial) {
            // FVF21 supplies white vertex RGBA. The selected source shaders
            // use that diffuse value, rather than POL material opacity.
            material.alpha = 1;
            material.unlit = true;
            material.transparencyMode = entry.name === 'water' ?
              PBRMaterial.PBRMATERIAL_ALPHABLEND : PBRMaterial.PBRMATERIAL_ALPHATESTANDBLEND;
            material.alphaCutOff = 100/255;
            material.forceDepthWrite = true;
            material.backFaceCulling = true;
          }
        });
        if (entry.name === 'water') this.water = container;
        else this.wave = container;
        container.meshes.forEach(mesh => {
          mesh.metadata = {...mesh.metadata, sourceSceneWater: entry.name};
          // Native queue sorts descending priority; Babylon alphaIndex ascends.
          mesh.alphaIndex = entry.name === 'water' ? 101 : 0;
        });
      }
      for (const entry of resource.textures) {
        await new Promise<void>((resolve, reject) => {
          const texture = new Texture(`/${entry.asset}`, this.scene, true, false,
            Texture.BILINEAR_SAMPLINGMODE, resolve, message => reject(new Error(message)));
          texture.wrapU = texture.wrapV = Texture.WRAP_ADDRESSMODE;
          texture.anisotropicFilteringLevel = 1;
          this.textures.push(texture);
        });
        if (this.disposed) return;
      }
      this.selectTexture();
      this.containers.forEach(container => {container.addAllToScene();});
      this.textureStarted = performance.now()/1000;
    } catch (error) {
      this.dispose();
      throw error;
    }
  }

  advance(deltaSeconds: number): void {
    if (this.disposed || !this.water || !this.textures.length) return;
    //462d14 uses a wall timer for texture selection and scene delta for water.
    //A long update advances one texture, without accumulating skipped frames.
    const now = performance.now()/1000;
    if (now-this.textureStarted > Math.fround(.05)) {
      this.textureIndex = (this.textureIndex+1)&31;
      this.selectTexture();
      this.textureStarted = now;
    }
    this.offset = Math.fround(this.offset+Math.fround(deltaSeconds)*Math.fround(.05));
    if (this.offset > 64) this.offset = Math.fround(this.offset-64);
    this.water.materials.forEach(material => {
      if (material instanceof PBRMaterial && material.albedoTexture instanceof Texture) {
        //462dc6 translates gfx+d8, passed as matex0 to water_effect.gbf.
        material.albedoTexture.vOffset = this.offset;
      }
    });
  }

  dispose(): void {
    this.disposed = true;
    this.containers.splice(0).forEach(container => {container.dispose();});
    this.textures.splice(0).forEach(texture => {texture.dispose();});
    this.wave = this.water = undefined;
  }

  private selectTexture(): void {
    this.wave?.materials.forEach(material => {
      if (material instanceof PBRMaterial) material.albedoTexture = this.textures[this.textureIndex];
    });
  }
}
