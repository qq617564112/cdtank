import {Color3, Mesh, MeshBuilder, Scene, StandardMaterial} from '@babylonjs/core';
import type {MsgRoomSnapshot} from '../../../shared/protocols';

/** Gameplay markers for rebuilt objectives; independent of original effects. */
export class BattleTargets {
  private readonly markers = new Map<string, {mesh: Mesh; material: StandardMaterial}>();

  constructor(private readonly scene: Scene) {}

  update(snapshot: MsgRoomSnapshot): void {
    const present = new Set<string>();
    for (const objective of snapshot.match?.objectives ?? []) {
      if (objective.sourcePlacementId !== undefined) continue;
      if (objective.kind === 'DESTROY' && objective.hp <= 0) continue;
      present.add(objective.id);
      let marker = this.markers.get(objective.id);
      if (!marker) {
        const mesh = objective.kind === 'CAPTURE'
          ? MeshBuilder.CreateCylinder(`objective-${objective.id}`, {
            height: 1, diameter: objective.radius * 2, tessellation: 48,
          }, this.scene)
          : MeshBuilder.CreateSphere(`objective-${objective.id}`, {
            diameter: objective.radius * 2, segments: 12,
          }, this.scene);
        const material = new StandardMaterial(`objective-material-${objective.id}`, this.scene);
        material.alpha = objective.kind === 'CAPTURE' ? 0.45 : 1;
        mesh.material = material;
        mesh.isPickable = false;
        marker = {mesh, material};
        this.markers.set(objective.id, marker);
      }
      marker.mesh.position.set(-objective.x, objective.y + (objective.kind === 'CAPTURE' ? 1 : 20), objective.z);
      marker.material.diffuseColor = objective.contested ? new Color3(1, 0.2, 0.2)
        : objective.ownerTeam === 0 ? new Color3(0.3, 0.7, 1)
        : objective.ownerTeam === 1 ? new Color3(1, 0.5, 0.2) : new Color3(1, 0.8, 0.2);
      marker.material.emissiveColor = marker.material.diffuseColor.scale(0.35);
    }
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
