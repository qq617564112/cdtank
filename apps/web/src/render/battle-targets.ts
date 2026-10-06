import {Color3, Mesh, MeshBuilder, Scene, StandardMaterial} from '@babylonjs/core';
import type {MsgRoomSnapshot} from '../../../shared/protocols';

/** Gameplay markers that have no original scene model to render them. Mode 2
 * Castle and mode 5 Breach identity come from source placements and are drawn
 * by the scene renderer; this class never invents placeholder geometry for them.
 */
export class BattleTargets {
  private readonly markers = new Map<string, {mesh: Mesh; material: StandardMaterial}>();

  constructor(private readonly scene: Scene) {}

  update(snapshot: MsgRoomSnapshot): void {
    const present = new Set<string>();
    for (const player of snapshot.players.filter(value => value.isVIP && value.alive)) {
      const id = `VIP-${player.id}`;
      present.add(id);
      let marker = this.markers.get(id);
      if (!marker) {
        const mesh = MeshBuilder.CreateCylinder(id, {height: 20, diameterTop: 0, diameterBottom: 16}, this.scene);
        const material = new StandardMaterial(`${id}-material`, this.scene);
        material.emissiveColor = new Color3(1, 0.85, 0.15);
        mesh.material = material;
        mesh.isPickable = false;
        marker = {mesh, material};
        this.markers.set(id, marker);
      }
      marker.mesh.position.set(-player.x, player.y + 75, player.z);
    }
    for (const [id, marker] of this.markers) {
      if (!present.has(id)) {
        marker.mesh.dispose();
        marker.material.dispose();
        this.markers.delete(id);
      }
    }
  }

  clear(): void {
    for (const marker of this.markers.values()) {
      marker.mesh.dispose();
      marker.material.dispose();
    }
    this.markers.clear();
  }
}
