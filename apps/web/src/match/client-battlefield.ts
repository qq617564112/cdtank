import {NavigationGrid} from '../../../shared/movement/navigation';
import type {SourceMovementField} from '../../../shared/movement/movement-field';
import type {MsgRoomSnapshot, ObjectiveSnapshot, SceneObjectSnapshot,
  SceneCrushSnapshot} from '../../../shared/protocols/MsgRoomSnapshot';
import {loadStaticJson} from '../assets/static-resources';

interface MovementSurface {
  id: string;
  cells: ReadonlySet<number>;
  enabled: boolean;
}

/** Client movement samples the original NAV with precomputed scene occupancy. */
export class ClientBattlefield {
  navigation?: NavigationGrid;
  private readonly surfaces = new Map<string, MovementSurface>();
  private readonly active = new Set<string>();
  private readonly objects = new Map<string, ObjectiveSnapshot | SceneObjectSnapshot>();
  private readonly crushes = new Map<string, SceneCrushSnapshot>();
  private readonly animated = new Map<string, {id: string; cells: number[]}>();
  private snapshot?: MsgRoomSnapshot;
  private synchronizedNavigation?: NavigationGrid;
  private synchronizedAt = NaN;
  private nextDestroyedAt?: number;
  private revision = 0;

  async load(mapId: number): Promise<void> {
    this.clear();
    const revision = this.revision;
    const field = await loadStaticJson<SourceMovementField>(
      `/data/maps/${String(mapId).padStart(4, '0')}/movement.json`, false);
    if (revision !== this.revision) return;
    if (Number(field.id) !== mapId) throw new Error('地图运动数据缺失');
    const navigation = new NavigationGrid(field.navigation);
    for (const surface of field.surfaces) {
      const cells = new Set(surface.cells);
      this.surfaces.set(surface.id, {id: surface.id, cells, enabled: surface.enabled});
      if (surface.enabled) {
        navigation.setBlocker(surface.id, cells);
        this.active.add(surface.id);
      }
    }
    this.navigation = navigation;
  }

  reconcile(snapshot: MsgRoomSnapshot, now: number): void {
    // RoomFeed replaces snapshots; animated blockers and fade expiry still update per frame.
    if (this.snapshot === snapshot && this.synchronizedNavigation === this.navigation
      && now >= this.synchronizedAt && !snapshot.match?.animatedBlockers?.length
      && (this.nextDestroyedAt === undefined || !(now - this.nextDestroyedAt > 2000))) {
      this.synchronizedAt = now;
      return;
    }
    this.snapshot = snapshot;
    this.synchronizedNavigation = this.navigation;
    this.synchronizedAt = now;
    this.nextDestroyedAt = undefined;
    const {objects, crushes, animated} = this;
    objects.clear();
    crushes.clear();
    animated.clear();
    const match = snapshot.match;
    if (match?.objectives) {
      for (const object of match.objectives) {
        if (object.sourcePlacementId !== undefined) objects.set(object.sourcePlacementId, object);
      }
    }
    if (match?.sceneObjects) {
      for (const object of match.sceneObjects) {
        if (object.sourcePlacementId !== undefined) objects.set(object.sourcePlacementId, object);
      }
    }
    if (match?.sceneCrushes) {
      for (const object of match.sceneCrushes) crushes.set(object.sourcePlacementId, object);
    }
    if (match?.animatedBlockers) {
      for (const blocker of match.animatedBlockers) animated.set(blocker.id, blocker);
    }
    for (const surface of this.surfaces.values()) {
      const id = surface.id;
      const object = objects.get(id), crush = crushes.get(id);
      const enabled = crush ? crush.enabled && !crush.hidden : object
        ? !(object.hp <= 0 && object.destroyedAt !== undefined && now - object.destroyedAt > 2000)
        : surface.enabled;
      if (!crush && object && object.hp <= 0 && object.destroyedAt !== undefined
        && !(now - object.destroyedAt > 2000)
        && (this.nextDestroyedAt === undefined || object.destroyedAt < this.nextDestroyedAt)) {
        this.nextDestroyedAt = object.destroyedAt;
      }
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
    this.objects.clear();
    this.crushes.clear();
    this.animated.clear();
    this.snapshot = undefined;
    this.synchronizedNavigation = undefined;
    this.synchronizedAt = NaN;
    this.nextDestroyedAt = undefined;
  }
}
