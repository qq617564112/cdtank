export interface RolePropertyRegistryRecord {
  objectId: number;
  mode: number;
}

export interface RolePropertyRegistry<T extends RolePropertyRegistryRecord> {
  all: Map<number, T>;
  mode1: Map<number, T>;
  mode2: Map<number, T>;
}

export interface RolePropertyCreationFactory<T, M> {
  create(): T;
  declare(record: T): void;
  bind(record: T, objectId: number, metadata: M): void;
  release(record: T): void;
}

/** Original528170: create/declare/bind, dispatch initial message, then register. */
export function createRolePropertyRecordFromMessage<T extends RolePropertyRegistryRecord, M>(
  registry: RolePropertyRegistry<T>,
  objectId: number,
  type: number,
  metadata: M | undefined,
  factories: ReadonlyMap<number, RolePropertyCreationFactory<T, M>>,
  dispatch: (record: T) => boolean,
  attached: (record: T) => void,
): boolean {
  if (metadata === undefined) return false;
  const factory = factories.get(type & 0xffff);
  if (!factory) return false;
  const record = factory.create();
  factory.declare(record);
  factory.bind(record, objectId >>> 0, metadata);
  if (!dispatch(record)) {
    factory.release(record);
    return false;
  }
  registerRolePropertyRecord(registry, record, attached);
  return true;
}

/** Original5275f0 creates three empty object tables. */
export function createRolePropertyRegistry<T extends RolePropertyRegistryRecord>(): RolePropertyRegistry<T> {
  return {all: new Map(), mode1: new Map(), mode2: new Map()};
}

/** Original528030/5280d0: total-table insertion and callback precede mode insertion. */
export function registerRolePropertyRecord<T extends RolePropertyRegistryRecord>(
  registry: RolePropertyRegistry<T>,
  record: T,
  attached: (record: T) => void,
): boolean {
  if (record.mode !== 1 && record.mode !== 2) return false;
  const key = record.objectId >>> 0;
  if (registry.all.has(key)) return false;
  registry.all.set(key, record);
  attached(record);
  (record.mode === 1 ? registry.mode1 : registry.mode2).set(key, record);
  return true;
}

/** Original526a70: detach callback precedes removal; retirement follows it. */
export function unregisterRolePropertyRecord<T extends RolePropertyRegistryRecord>(
  registry: RolePropertyRegistry<T>,
  objectId: number,
  detached: (record: T) => void,
  retired: (record: T) => void,
): boolean {
  const key = objectId >>> 0;
  const record = registry.all.get(key);
  if (!record) return false;
  detached(record);
  if (record.mode === 1) registry.mode1.delete(key);
  else if (record.mode === 2) registry.mode2.delete(key);
  registry.all.delete(key);
  retired(record);
  return true;
}
