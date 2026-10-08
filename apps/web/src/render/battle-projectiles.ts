import {Color3, Mesh, MeshBuilder, Quaternion, Scene, StandardMaterial, Vector3} from '@babylonjs/core';
import type {BulletSnapshot, MsgRoomSnapshot} from '../../../shared/protocols';

const BODY_DIAMETER = 6;
const TRAIL_LENGTH = 18;
const MAX_EXTRAPOLATION_MS = 100;

interface BulletPresentation {
  readonly body: Mesh;
  readonly trail: Mesh;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
}

/** Presentation-only consumer for the authoritative special-ammo bullet stream. */
export class BattleProjectiles {
  private readonly bullets = new Map<string, BulletPresentation>();
  private readonly bodyMaterial: StandardMaterial;
  private readonly trailMaterial: StandardMaterial;
  private readonly localPosition = new Vector3();
  private readonly direction = new Vector3();
  private readonly up = new Vector3(0, 1, 0);
  private snapshotServerTimeMs = 0;
  private scopeRoomId?: string;
  private scopeRound?: number;
  private disposed = false;

  constructor(private readonly scene: Scene) {
    this.bodyMaterial = new StandardMaterial('battle-projectile-body-material', scene);
    this.bodyMaterial.disableLighting = true;
    this.bodyMaterial.diffuseColor = Color3.Black();
    this.bodyMaterial.specularColor = Color3.Black();
    this.bodyMaterial.emissiveColor = new Color3(1, 0.85, 0.15);
    this.trailMaterial = new StandardMaterial('battle-projectile-trail-material', scene);
    this.trailMaterial.disableLighting = true;
    this.trailMaterial.diffuseColor = Color3.Black();
    this.trailMaterial.specularColor = Color3.Black();
    this.trailMaterial.emissiveColor = new Color3(1, 0.5, 0.08);
    this.trailMaterial.alpha = 0.65;
    this.trailMaterial.backFaceCulling = false;
    scene.onDisposeObservable.addOnce(() => {this.dispose();});
  }

  reconcile(snapshot: MsgRoomSnapshot): void {
    if (this.disposed) return;
    const round = snapshot.match?.round ?? 0;
    if (snapshot.phase !== 'PLAYING') {
      this.clear();
      this.scopeRoomId = snapshot.roomId;
      this.scopeRound = round;
      return;
    }
    if (this.scopeRoomId !== snapshot.roomId || this.scopeRound !== round) {
      this.clear();
      this.scopeRoomId = snapshot.roomId;
      this.scopeRound = round;
    }
    this.snapshotServerTimeMs = snapshot.serverTime;
    const present = new Set<string>();
    for (const bullet of snapshot.bullets) {
      present.add(bullet.id);
      let presentation = this.bullets.get(bullet.id);
      if (!presentation) {
        presentation = this.createPresentation(bullet.id);
        this.bullets.set(bullet.id, presentation);
      }
      this.applySnapshot(presentation, bullet);
    }
    for (const [id, presentation] of this.bullets) {
      if (present.has(id)) continue;
      this.disposePresentation(presentation);
      this.bullets.delete(id);
    }
  }

  render(nowServerMs: number): void {
    if (this.disposed) return;
    const elapsedMs = Math.max(0, Math.min(MAX_EXTRAPOLATION_MS, nowServerMs - this.snapshotServerTimeMs));
    const elapsedSeconds = elapsedMs / 1000;
    for (const presentation of this.bullets.values()) {
      this.place(presentation, elapsedSeconds);
    }
  }

  clear(): void {
    for (const presentation of this.bullets.values()) this.disposePresentation(presentation);
    this.bullets.clear();
    this.snapshotServerTimeMs = 0;
    this.scopeRoomId = undefined;
    this.scopeRound = undefined;
  }

  dispose(): void {
    if (this.disposed) return;
    this.clear();
    this.disposed = true;
    this.bodyMaterial.dispose();
    this.trailMaterial.dispose();
  }

  private createPresentation(id: string): BulletPresentation {
    const body = MeshBuilder.CreateSphere(`battle-projectile-${id}`, {
      diameter: BODY_DIAMETER,
      segments: 8,
    }, this.scene);
    body.material = this.bodyMaterial;
    body.isPickable = false;
    const trail = MeshBuilder.CreateCylinder(`battle-projectile-${id}-trail`, {
      height: TRAIL_LENGTH,
      diameterTop: 0.5,
      diameterBottom: 2,
      tessellation: 8,
    }, this.scene);
    trail.material = this.trailMaterial;
    trail.isPickable = false;
    trail.rotationQuaternion = Quaternion.Identity();
    return {body, trail, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0};
  }

  private applySnapshot(presentation: BulletPresentation, bullet: BulletSnapshot): void {
    presentation.x = bullet.x;
    presentation.y = bullet.y;
    presentation.z = bullet.z;
    presentation.vx = bullet.vx;
    presentation.vy = bullet.vy;
    presentation.vz = bullet.vz;
    this.place(presentation, 0);
  }

  private place(presentation: BulletPresentation, elapsedSeconds: number): void {
    this.localPosition.set(
      -(presentation.x + presentation.vx * elapsedSeconds),
      presentation.y + presentation.vy * elapsedSeconds,
      presentation.z + presentation.vz * elapsedSeconds,
    );
    presentation.body.position.copyFrom(this.localPosition);
    const webVx = -presentation.vx;
    const speedSquared = webVx * webVx + presentation.vy * presentation.vy + presentation.vz * presentation.vz;
    if (speedSquared <= 0.000001) {
      presentation.trail.setEnabled(false);
      return;
    }
    presentation.trail.setEnabled(true);
    const inverseSpeed = 1 / Math.sqrt(speedSquared);
    this.direction.set(webVx * inverseSpeed, presentation.vy * inverseSpeed, presentation.vz * inverseSpeed);
    const rotation = presentation.trail.rotationQuaternion ?? Quaternion.Identity();
    Quaternion.FromUnitVectorsToRef(this.up, this.direction, rotation);
    presentation.trail.rotationQuaternion = rotation;
    presentation.trail.position.set(
      this.localPosition.x - this.direction.x * TRAIL_LENGTH / 2,
      this.localPosition.y - this.direction.y * TRAIL_LENGTH / 2,
      this.localPosition.z - this.direction.z * TRAIL_LENGTH / 2,
    );
  }

  private disposePresentation(presentation: BulletPresentation): void {
    presentation.body.dispose();
    presentation.trail.dispose();
  }
}
