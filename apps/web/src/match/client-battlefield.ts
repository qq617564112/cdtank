import {NavigationGrid} from '../../../shared/movement/navigation';
import type {SourceMovementField} from '../../../shared/movement/movement-field';
import type {MsgRoomSnapshot} from '../../../shared/protocols/MsgRoomSnapshot';

/** Client movement samples the original NAV with precomputed scene occupancy. */
export class ClientBattlefield {
  navigation?: NavigationGrid;
  private readonly surfaces = new Map<string, {cells: ReadonlySet<number>; enabled: boolean}>();
  private readonly active = new Set<string>();
  private revision = 0;

  async load(mapId: number): Promise<void> {
    this.clear();
    const revision = this.revision;
    const response = await fetch(`/movement/${String(mapId).padStart(4, '0')}.json`);
    if (!response.ok) throw new Error('地图运动数据载入失败');
    const field = await response.json() as SourceMovementField;
    if (revision !== this.revision) return;
    if (Number(field.id) !== mapId) throw new Error('地图运动数据缺失');
    const navigation = new NavigationGrid(field.navigation);
    for (const surface of field.surfaces) {
      const cells = new Set(surface.cells);
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
    const animated = new Map((snapshot.match?.animatedBlockers ?? []).map(value => [value.id, value]));
    for (const [id, surface] of this.surfaces) {
      const object = objects.get(id), crush = crushes.get(id);
      const enabled = crush ? crush.enabled && !crush.hidden : object
        ? !(object.hp <= 0 && object.destroyedAt !== undefined && now - object.destroyedAt > 2000)
        : surface.enabled;
      if (!animated.has(id) && enabled === this.active.has(id)) continue;
      this.navigation?.setBlocker(id, enabled ? animated.has(id) ? new Set(animated.get(id)!.cells) : surface.cells : undefined);
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
