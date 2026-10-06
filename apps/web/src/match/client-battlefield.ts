import {Vector3, VertexBuffer} from '@babylonjs/core';
import {NavigationGrid, type SourceNavigationLayer} from '../../../shared/movement/navigation';
import {CollisionMesh, type Triangle} from '../../../shared/movement/collision-mesh';
import {navigationOccupancy} from '../../../shared/movement/navigation-collision';
import type {MsgRoomSnapshot} from '../../../shared/protocols/MsgRoomSnapshot';
import type {SceneMovementSurface} from '../assets/scenes/scene-preview';

/** Client movement samples the original NAV and the loaded scene's render faces. */
export class ClientBattlefield {
  navigation?: NavigationGrid;
  private readonly surfaces = new Map<string, {cells: ReadonlySet<number>; enabled: boolean}>();
  private readonly active = new Set<string>();
  private revision = 0;

  async load(mapId: number, surfaces: readonly SceneMovementSurface[]): Promise<void> {
    this.clear();
    const revision = this.revision;
    const response = await fetch('/battlefields.json');
    if (!response.ok) throw new Error('地图运动数据载入失败');
    const fields = await response.json() as {id: string; navigationLayers: SourceNavigationLayer[]}[];
    if (revision !== this.revision) return;
    const source = fields.find(field => Number(field.id) === mapId)?.navigationLayers[0];
    if (!source) throw new Error('地图运动数据缺失');
    const navigation = new NavigationGrid(source);
    for (const surface of surfaces) {
      const triangles: Triangle[] = [];
      for (const mesh of surface.meshes) {
        const positions = mesh.getVerticesData(VertexBuffer.PositionKind);
        if (!positions?.length) continue;
        const matrix = mesh.computeWorldMatrix(true);
        const vertices: number[][] = [];
        for (let at = 0; at < positions.length; at += 3) {
          const point = Vector3.TransformCoordinates(Vector3.FromArray(positions, at), matrix);
          vertices.push([-point.x, point.y, point.z]);
        }
        const indices = mesh.getIndices() ?? vertices.map((_, at) => at);
        for (let at = 0; at < indices.length; at += 3) {
          triangles.push([vertices[indices[at]], vertices[indices[at + 1]], vertices[indices[at + 2]]]);
        }
      }
      const mesh = new CollisionMesh(triangles);
      const cells = navigationOccupancy(mesh, navigation, surface.terrain);
      this.surfaces.set(surface.id, {cells, enabled: surface.enabled});
      if (surface.enabled) {
        navigation.setBlocker(surface.id, cells);
        this.active.add(surface.id);
      }
    }
    this.navigation = navigation;
  }

  reconcile(snapshot: MsgRoomSnapshot, now: number): void {
    const objects = new Map([...(snapshot.match?.objectives ?? []), ...(snapshot.match?.sceneObjects ?? [])]
      .filter(object => object.sourcePlacementId !== undefined).map(object => [object.sourcePlacementId!, object]));
    const crushes = new Map((snapshot.match?.sceneCrushes ?? []).map(object => [object.sourcePlacementId, object]));
    for (const [id, surface] of this.surfaces) {
      const object = objects.get(id), crush = crushes.get(id);
      const enabled = crush ? crush.enabled && !crush.hidden : object
        ? !(object.hp <= 0 && object.destroyedAt !== undefined && now - object.destroyedAt > 2000)
        : surface.enabled;
      if (enabled === this.active.has(id)) continue;
      this.navigation?.setBlocker(id, enabled ? surface.cells : undefined);
      if (enabled) this.active.add(id);
      else this.active.delete(id);
    }
  }

  clear(): void {
    this.revision++;
    this.navigation = undefined;
    this.surfaces.clear();
    this.active.clear();
  }
}
