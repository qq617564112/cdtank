import {Mesh, PBRMaterial, ShaderMaterial} from '@babylonjs/core';
import {createScenePlantMaterial} from '../../apps/web/src/assets/scenes/scene-plant-material';

export type PlantMaterialModel = 'obj05413' | 'obj05401' | 'obj05403' | 'obj05405';

/** Named Plant material ownership after independent sway meshes are created. */
export class ScenePlant05413MaterialOwner {
  private readonly replacements: {mesh: Mesh; original: PBRMaterial;
    material: ShaderMaterial}[] = [];

  constructor(private readonly properties: readonly number[]) {}

  register(mesh: Mesh, model: PlantMaterialModel = 'obj05413',
    properties: readonly number[] = this.properties): void {
    const original = mesh.material;
    if (!(original instanceof PBRMaterial) || !original.albedoTexture) {
      throw new Error(`原Plant ${model} 材质或纹理缺失`);
    }
    const material = createScenePlantMaterial(mesh.getScene(), properties,
      original.albedoTexture);
    material.name = `plant/${model}/${mesh.name}`;
    material.metadata = {...material.metadata, sourcePlantModel: model};
    mesh.material = material;
    this.replacements.push({mesh, original, material});
  }

  dispose(): void {
    for (const {mesh, original, material} of this.replacements) {
      if (!mesh.isDisposed()) mesh.material = original;
      material.dispose(false, false);
    }
    this.replacements.length = 0;
  }
}
