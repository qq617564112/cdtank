import {BoundingInfo, InstancedMesh, Mesh, PBRMaterial, ShaderMaterial,
  UniformBuffer, Vector2, Vector3} from '@babylonjs/core';
import {createScenePlantMaterial} from './scene-plant-material';
import {setSceneModelPriority} from '../../render/scene-model-order';

export type PlantMaterialModel = 'obj05413' | 'obj05416' | 'obj05401' | 'obj05403' | 'obj05405';

interface PlantSource {
  original: PBRMaterial;
  material: ShaderMaterial;
  bounds: BoundingInfo;
  minimum: Vector3;
  maximum: Vector3;
}

/** Plants retain source geometry and one material per source mesh. */
export class ScenePlant05413MaterialOwner {
  private readonly sources = new Map<Mesh, PlantSource>();
  private clock?: UniformBuffer;
  private elapsed = 0;

  constructor(private readonly properties: readonly number[]) {}

  register(mesh: Mesh | InstancedMesh, model: PlantMaterialModel = 'obj05413',
    properties: readonly number[] = this.properties, phase = 0, height = 1): void {
    const source = mesh instanceof InstancedMesh ? mesh.sourceMesh : mesh;
    let entry = this.sources.get(source);
    if (!entry) {
      const original = source.material;
      if (!(original instanceof PBRMaterial) || !original.albedoTexture) {
        throw new Error(`原Plant ${model} 材质或纹理缺失`);
      }
      if (!this.clock) {
        // One time value is shared by every draw in the frame, so the binding stays stable.
        this.clock = new UniformBuffer(source.getEngine(), undefined, false, 'source-plant-clock', false, false);
        this.clock.addUniform('sourcePlantClock', 4);
        this.clock.create();
        this.setAnimationTime(this.elapsed);
      }
      const material = createScenePlantMaterial(source.getScene(), properties, original.albedoTexture);
      material.name = `plant/${model}/${source.name}`;
      material.metadata = {...material.metadata, sourcePlantModel: model};
      material.setUniformBuffer('SourcePlantClock', this.clock);
      material.setVector2('plantSwayFallback', new Vector2(phase, height));
      source.registerInstancedBuffer('plantSway', 2);
      source.instancedBuffers.plantSway = new Vector2(phase, height);
      const bounds = source.getBoundingInfo();
      entry = {original, material, bounds, minimum: bounds.minimum.clone(), maximum: bounds.maximum.clone()};
      this.sources.set(source, entry);
      source.material = material;
      setSceneModelPriority(source, 0);
      // Alpha-tested edges retain blending and sort instances far to near.
      Mesh.INSTANCEDMESH_SORT_TRANSPARENT = true;
    }
    mesh.instancedBuffers.plantSway = new Vector2(phase, height);
    const extent = Math.max(Math.abs(entry.minimum.y), Math.abs(entry.maximum.y));
    const displacement = 0.15 / height * extent * extent;
    const minimum = entry.minimum.clone(), maximum = entry.maximum.clone();
    minimum.x -= displacement; maximum.x += displacement;
    mesh.setBoundingInfo(new BoundingInfo(minimum, maximum));
    for (const subMesh of mesh.subMeshes) subMesh.setBoundingInfo(new BoundingInfo(minimum, maximum));
    mesh.computeWorldMatrix(true);
  }

  setAnimationTime(seconds: number): void {
    this.elapsed = seconds;
    this.clock?.updateFloat4('sourcePlantClock', seconds, 0, 0, 0);
    this.clock?.update();
  }

  dispose(): void {
    for (const [mesh, entry] of this.sources) {
      if (!mesh.isDisposed()) {mesh.material = entry.original; mesh.setBoundingInfo(entry.bounds);}
      entry.material.dispose(false, false);
    }
    this.sources.clear();
    this.clock?.dispose();
    this.clock = undefined;
  }
}
