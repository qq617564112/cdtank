/** Original4173/4174 display receiver; no activation or inventory authority. */
export type RoleStyle = 1 | 2;

export interface RoleStylePosition {
  x: number;
  y: number;
  z: number;
}

/** Source object operations supplied by the eventual scene/role consumer. */
export interface RoleStylePresentationProvider {
  hasActor(roleId: number): boolean;
  setActorVisible(roleId: number, visible: boolean): void;
  rolePosition(roleId: number): RoleStylePosition;
  createWorldObject(model: 'obj05428' | 'obj05422', position: RoleStylePosition,
    sourceArgument1c: 2, sourceArgument20: 0): string;
  hasWorld(): boolean;
  removeWorldObject(name: string): void;
}

/** Preserve each source manager record, including repeated notifications. */
export interface RoleStyleObjectRecord {
  roleId: number;
  objectName: string;
}

export class RoleStylePresentation {
  private readonly records: RoleStyleObjectRecord[] = [];

  constructor(private readonly provider: RoleStylePresentationProvider) {}

  /** Original4860a7 ->42a9dd: hide first, then create at the received role pose. */
  change(roleId: number, style: RoleStyle): boolean {
    if (!this.provider.hasActor(roleId)) return false;
    this.provider.setActorVisible(roleId, false);
    const model = style === 1 ? 'obj05428' : 'obj05422';
    const position = this.provider.rolePosition(roleId);
    const objectName = this.provider.createWorldObject(model,
      {x: position.x, y: position.y, z: position.z}, 2, 0);
    this.records.push({roleId, objectName});
    return true;
  }

  /** Original4860e6 ->42a527: restore actor, then delete all matching names. */
  restore(roleId: number): boolean {
    if (!this.provider.hasActor(roleId)) return false;
    this.provider.setActorVisible(roleId, true);
    if (!this.provider.hasWorld()) return true;
    for (let index = 0; index < this.records.length;) {
      const record = this.records[index];
      if (record.roleId !== roleId) {
        index += 1;
        continue;
      }
      this.provider.removeWorldObject(record.objectName);
      this.records.splice(index, 1);
    }
    return true;
  }
}
