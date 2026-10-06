export interface RolePropertyMember {
  dispose(): void;
}

export interface RolePropertyManagerState {
  fields: (RolePropertyMember | undefined)[];
  secondaryMembers: (RolePropertyMember | undefined)[];
  nextFieldIndex: number;
  nextSecondaryIndex: number;
  objectId: number;
  mode: number;
  network: unknown;
  metadata: unknown;
}

/** Original529480 releases members, then resets indices and routing references. */
export function clearRolePropertyManager(state: RolePropertyManagerState): void {
  for (const field of state.fields) field?.dispose();
  for (const member of state.secondaryMembers) member?.dispose();
  state.fields = [];
  state.secondaryMembers = [];
  state.nextFieldIndex = 0;
  state.nextSecondaryIndex = 0;
  state.network = undefined;
  state.metadata = undefined;
  state.mode = 0;
  state.objectId = 0xffffffff;
}

/** Original525030: mode1 clears metadata; mode2 calls the registered factory return. */
export function retireRolePropertyRecord<T>(
  record: T,
  mode: number,
  type: number,
  clear: (record: T) => void,
  factories: ReadonlyMap<number, (record: T) => void>,
): boolean {
  if (mode === 1) clear(record);
  else if (mode === 2) {
    const release = factories.get(type & 0xffff);
    if (!release) return false;
    release(record);
  }
  return true;
}
