import {InstancedMesh, Mesh, TransformNode, VertexBuffer} from '@babylonjs/core';
import {PlantMaterialModel, ScenePlant05413MaterialOwner} from './scene-plant-material-owner';

interface PlantResource {
  sourcePlacementId: string;
  model: string;
  height: number;
  enabled: boolean;
}

interface PlantMaterialResource {
  model: PlantMaterialModel;
  mesh: string;
  properties: number[];
}

interface PlantMesh {
  mesh: Mesh;
  source: Float32Array;
  positions: Float32Array;
}

interface PlantOwner {
  phase: number;
  parameter: number;
  height: number;
  meshes: PlantMesh[];
}

/** Original Plant cosine producer and plant80.gbf vertex displacement. */
export class ScenePlantSway {
  private readonly resources = new Map<string, PlantResource>();
  private readonly owners = new Map<string, PlantOwner>();
  private disposed = false;
  private materialOwner?: ScenePlant05413MaterialOwner;
  private readonly materials = new Map<string, PlantMaterialResource>();

  async load(mapId: string): Promise<void> {
    if (!['0002', '0003', '0004', '0005', '0006', '0008', '0012', '0016', '0017', '0019',
      '0021', '0023', '0024', '0025'].includes(mapId)) return;
    const response = await fetch(`/scene-plant-${mapId}.json`);
    if (!response.ok) throw new Error('原植物摆动资源载入失败');
    const resource = await response.json() as {mapId: number; plants: PlantResource[]};
    if (this.disposed) return;
    if (resource.mapId !== Number(mapId)) throw new Error('原植物地图身份不符');
    const materialResponse = await fetch('/scene-plant-material-05413.json');
    if (!materialResponse.ok) throw new Error('原Plant材质资源载入失败');
    const material = await materialResponse.json() as {models: PlantMaterialResource[]};
    if (this.disposed) return;
    for (const value of material.models) this.materials.set(value.model, value);
    const primary = this.materials.get('obj05413');
    if (!primary || primary.mesh !== 'plane507/0') {
      throw new Error('原Plant05413材质身份不符');
    }
    this.materialOwner = new ScenePlant05413MaterialOwner(primary.properties);
    for (const plant of resource.plants) this.resources.set(plant.sourcePlacementId, plant);
  }

  register(id: string, root: TransformNode): void {
    const resource = this.resources.get(id);
    if (!resource || this.disposed) return;
    const meshes: PlantMesh[] = [];
    for (const child of root.getChildMeshes()) {
      let mesh: Mesh;
      if (child instanceof InstancedMesh) {
        mesh = child.sourceMesh.clone(child.name, child.parent, true)!;
        mesh.position.copyFrom(child.position);
        mesh.scaling.copyFrom(child.scaling);
        mesh.rotation.copyFrom(child.rotation);
        mesh.rotationQuaternion = child.rotationQuaternion?.clone() ?? null;
        mesh.isVisible = child.isVisible;
        mesh.visibility = child.visibility;
        mesh.setEnabled(child.isEnabled(false));
        child.dispose();
      } else if (child instanceof Mesh && child.getTotalVertices()) {
        mesh = child;
      } else {
        continue;
      }
      mesh.makeGeometryUnique();
      const source = Float32Array.from(mesh.getVerticesData(VertexBuffer.PositionKind)!);
      const positions = Float32Array.from(source);
      mesh.setVerticesData(VertexBuffer.PositionKind, positions, true);
      mesh.metadata = {...mesh.metadata, sourcePlantSway: id};
      const material = this.materials.get(resource.model);
      if (material) this.materialOwner?.register(mesh, material.model, material.properties);
      meshes.push({mesh, source, positions});
    }
    //45589c supplies rand15 *120*f32(1/32767). Browser entropy is the provider.
    const phase = Math.fround(Math.floor(Math.random()*32768)*120*Math.fround(1/32767));
    this.owners.set(id, {phase, parameter: 0, height: resource.height, meshes});
  }

  advance(deltaSeconds: number): void {
    if (this.disposed) return;
    const delta = Math.fround(deltaSeconds);
    const period = Math.fround(6.28318);
    for (const owner of this.owners.values()) {
      let phase = owner.phase+delta*2;
      if (phase > period) phase -= period;
      owner.phase = Math.fround(phase);
      owner.parameter = Math.fround(Math.cos(owner.phase)/owner.height*Math.fround(.15));
      for (const value of owner.meshes) {
        for (let index = 0; index < value.source.length; index += 3) {
          const y = value.source[index+1];
          // Keep original vertices as the base; deformation never accumulates.
          const displacement = Math.fround(Math.fround(owner.parameter*y)*y);
          value.positions[index] = Math.fround(value.source[index]+displacement);
        }
        value.mesh.updateVerticesData(VertexBuffer.PositionKind, value.positions, true);
        // Reconstructed bounds need the placement matrix before frustum culling.
        value.mesh.computeWorldMatrix(true);
      }
    }
  }

  dispose(): void {
    this.disposed = true;
    this.materialOwner?.dispose();
    this.materialOwner = undefined;
    this.materials.clear();
    for (const owner of this.owners.values()) {
      owner.meshes.forEach(value => {value.mesh.dispose();});
    }
    this.owners.clear();
    this.resources.clear();
  }
}
