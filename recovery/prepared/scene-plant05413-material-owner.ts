import {Mesh, PBRMaterial, ShaderMaterial} from '@babylonjs/core';
import {createScenePlantMaterial} from '../../apps/web/src/assets/scenes/scene-plant-material';

/** Named05413 material ownership after independent sway meshes are created. */
export class ScenePlant05413MaterialOwner {
  private readonly replacements: {mesh: Mesh; original: PBRMaterial;
    material: ShaderMaterial}[] = [];

  constructor(private readonly properties: readonly number[]) {}

  register(mesh: Mesh): void {
    const original = mesh.material;
    if (!(original instanceof PBRMaterial) || !original.albedoTexture) {
      throw new Error('原Plant05413材质或纹理缺失');
    }
    const material = createScenePlantMaterial(mesh.getScene(), this.properties,
      original.albedoTexture);
    material.name = `plant05413/${mesh.name}`;
    material.metadata = {...material.metadata, sourcePlantModel: 'obj05413'};
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
