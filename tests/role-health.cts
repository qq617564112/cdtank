import {setRoleHp} from '../apps/server/src/battle/roles/health';
import type {RoleSkillRecord} from '../apps/shared/contracts/role-skills';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {applyRoleHealthProperty, encodeRoleHealthProperty, receiveRoleHealthProperties, type RoleHealthRecord} from '../recovery/evidence/combat/role-health';
import {detectRolePropertyChanges, rolePropertyBytesChanged} from '../recovery/evidence/combat/role-property-dirty';
import {markRolePropertyDirty} from '../apps/server/src/battle/roles/property-dirty';
import {routeRegisteredRolePropertyMessage, routeRolePropertyMessage} from '../recovery/evidence/combat/role-property-route';
import {createRolePropertyRecordFromMessage, createRolePropertyRegistry, registerRolePropertyRecord, unregisterRolePropertyRecord} from '../recovery/evidence/combat/role-property-registry';
import {dispatchRolePropertyEvent} from '../recovery/evidence/combat/role-property-events';
import {clearRolePropertyManager, retireRolePropertyRecord} from '../recovery/evidence/combat/role-property-cleanup';
import {dispatchRoleObjectMessage} from '../recovery/evidence/combat/role-object-dispatch';
import {dispatchRoleNetworkMessage, readRoleNetworkMessage} from '../recovery/evidence/combat/role-network-message';
import {encodeRoleArrayProperty, receiveRoleArrayProperties, type RoleArrayProperty} from '../recovery/evidence/combat/role-array-property';
import {createRoleCombatState} from '../apps/server/src/battle/roles/combat-state';
import {selectRoleSkills} from '../apps/server/src/battle/roles/skills';

interface HealthEvent {
  kind: 'notify' | 'changed';
  index?: number;
  previousHp?: number;
  state: RoleHealthRecord;
}
const evidence: {rows: {
  present: boolean;
  observer: boolean;
  before: number;
  maxHp: number;
  value: number;
  accepted: boolean;
  result: RoleHealthRecord | null;
  events: HealthEvent[];
}[]} = JSON.parse(readFileSync('recovery/output/role-health-native.json', 'utf8'));

for (const row of evidence.rows) {
  const record = row.present ? {hp: row.before, maxHp: row.maxHp} : undefined;
  const events: HealthEvent[] = [];
  const accepted = setRoleHp(record, row.value,
    index => events.push({kind: 'notify', index, state: {...record!}}),
    row.observer ? previousHp => events.push({kind: 'changed', previousHp, state: {...record!}}) : undefined);
  assert.equal(accepted, row.accepted);
  assert.deepEqual(record ?? null, row.result);
  assert.deepEqual(events, row.events);
}
console.log(`PASS: ${evidence.rows.length} shared HP assignments and observer states match original x86`);

const properties: {rows: {index: number; bits: number; result: RoleHealthRecord}[]} = JSON.parse(
  readFileSync('recovery/output/role-properties-native.json', 'utf8'));
for (const row of properties.rows) {
  const record = {hp: 37, maxHp: 200};
  assert.equal(applyRoleHealthProperty(record, row.index, row.bits), true);
  assert.deepEqual(record, row.result);
}
const record = {hp: 37, maxHp: 200};
assert.equal(applyRoleHealthProperty(record, 11, 99), false);
assert.deepEqual(record, {hp: 37, maxHp: 200});
console.log(`PASS: ${properties.rows.length} shared raw HP/MaxHP property writes match original x86`);

const notifications: {
  dirtyRows: {seed: number[]; index: number; words: number[]}[];
  healthRows: (typeof evidence.rows[number] & {words: number[]})[];
  detectRows: {
    mode: number; schemaMode: number; seed: number[];
    properties: {category: number; current?: number[]; snapshot?: number[]}[];
    detected: boolean; words: number[]; visits: number[];
  }[];
  wireRows: {index: 12 | 13; bits: number; bytes: number[]}[];
  receiveRows: {
    observer: boolean; segments: number[][]; accepted: boolean;
    result: RoleHealthRecord;
    events: {index: number; context: number; state: RoleHealthRecord}[];
  }[];
  routeRows: {
    objectId: number; messageObjectId: number; command: number; segments: number[][];
    handled: boolean; result: RoleHealthRecord;
    events: {index: number; context: number; state: RoleHealthRecord}[]; calls: string[];
  }[];
  registryRows: {
    messageObjectId: number; messageType: number; recordType: number; command: number;
    segments: number[][]; handled: boolean;
    events: {index: number; context: number; state: RoleHealthRecord}[];
  }[];
  lifecycleRows: {
    operation: 'register' | 'unregister'; objectId: number; mode: number; accepted: boolean;
    state: RegistryState; events: {kind: string; objectId: number; state: RegistryState}[];
  }[];
  liveRouteRows: {
    table: 'all' | 'mode1' | 'mode2'; objectId: number; handled: boolean;
    result: RoleHealthRecord | null; segments: number[][];
  }[];
  eventRows: {
    operation: 'register' | 'unregister'; objectId: number; mode: number; accepted: boolean;
    state: RegistryState; observer: boolean;
    forwarded: {kind: string; objectId: number; context: number; state: RegistryState}[];
  }[];
  cleanupRows: {
    before: CleanupState; after: CleanupState; released: number[];
  }[];
  retirementRows: {mode: number; type: number; accepted: boolean; released: boolean; cleared: boolean}[];
  registeredFactory: {
    type: number; beforeHealth: RoleHealthRecord; afterHealth: RoleHealthRecord;
    receivedSegment: number[]; recordFreed: boolean; registryEmpty: boolean;
  };
  creationRows: {
    command: number; type: number; metadata: boolean; segments: number[][];
    accepted: boolean; result: RoleHealthRecord | null; registryEmptyAfterRemoval: boolean;
  }[];
  arraySkillCatalog: RoleSkillRecord[];
  arrayWireRows: {
    index: number; width: 1 | 2 | 4; count: number; mode: number;
    baseline: number[]; values: number[]; bytes: number[]; sourceSkillIds?: boolean;
  }[];
  arrayReceiveRows: {
    observer: boolean; segments: number[][]; before: Record<string, number[]>;
    accepted: boolean; result: Record<string, number[]>;
    events: {index: number; context: number; arrays: Record<string, number[]>}[];
  }[];
  packetRows: {raw: number[]; bytes: number[]; payload: number[]}[];
  inletRows: {
    raw: number[]; networkState: number; events: string[];
    before: RegistryState; after: RegistryState; result: RoleHealthRecord | null;
  }[];
  dispatchRows: {
    category: number; recipient: number; command: number; objectId: number;
    accepted: boolean; before: RegistryState; after: RegistryState;
  }[];
} = JSON.parse(readFileSync('recovery/output/role-properties-native.json', 'utf8'));
for (const row of notifications.dirtyRows) {
  const words = new Uint32Array(row.seed);
  markRolePropertyDirty(words, row.index);
  assert.deepEqual([...words], row.words);
}
for (const row of notifications.healthRows) {
  const health = row.present ? {hp: row.before, maxHp: row.maxHp} : undefined;
  const words = new Uint32Array(8);
  const events: HealthEvent[] = [];
  const accepted = setRoleHp(health, row.value, index => {
    events.push({kind: 'notify', index, state: {...health!}});
    markRolePropertyDirty(words, index);
  }, row.observer ? previousHp => {
    events.push({kind: 'changed', previousHp, state: {...health!}});
  } : undefined);
  assert.equal(accepted, row.accepted);
  assert.deepEqual(health ?? null, row.result);
  assert.deepEqual(events, row.events);
  assert.deepEqual([...words], row.words);
}
console.log('PASS: 512 dirty bitsets and 120 HP setter/real-manager chains match original x86');

for (const row of notifications.detectRows) {
  const words = new Uint32Array(row.seed);
  const visits: number[] = [];
  const probes = row.properties.map((property, index) => ({
    category: property.category,
    changed: () => {
      visits.push(index);
      // This fixture's real nickname and string snapshot are both empty.
      return Number(rolePropertyBytesChanged(
        property.current ? new Uint8Array(property.current) : undefined,
        property.snapshot ? new Uint8Array(property.snapshot) : undefined));
    },
  }));
  assert.equal(detectRolePropertyChanges(words, row.mode, row.schemaMode, probes), row.detected);
  assert.deepEqual([...words], row.words);
  assert.deepEqual(visits, row.visits);
}
console.log(`PASS: ${notifications.detectRows.length} property change scans match original x86`);
for (const row of notifications.wireRows) {
  assert.deepEqual([...encodeRoleHealthProperty(row.index, row.bits)], row.bytes);
}
console.log('PASS: 14 HP/MaxHP numeric segments match original x86');
for (const row of notifications.receiveRows) {
  const health = {hp: 37, maxHp: 200};
  const events: typeof row.events = [];
  const accepted = receiveRoleHealthProperties(health,
    row.segments.map(bytes => new Uint8Array(bytes)), 0x11223344,
    row.observer ? (index, context) => events.push({index, context, state: {...health}}) : undefined);
  assert.equal(accepted, row.accepted);
  assert.deepEqual(health, row.result);
  assert.deepEqual(events, row.events);
}
console.log(`PASS: ${notifications.receiveRows.length} health property receives match original x86`);
for (const row of notifications.routeRows) {
  const health = {hp: 37, maxHp: 200};
  const events: typeof row.events = [];
  const calls: string[] = [];
  const handled = routeRolePropertyMessage(row.objectId, row.messageObjectId, row.command, {
    command3: () => { calls.push('command3'); return false; },
    properties: () => receiveRoleHealthProperties(health,
      row.segments.map(bytes => new Uint8Array(bytes)), 0x11223344,
      (index, context) => events.push({index, context, state: {...health}})),
    commands6To9: () => { calls.push('commands6To9'); return false; },
  });
  assert.equal(handled, row.handled);
  assert.deepEqual(health, row.result);
  assert.deepEqual(events, row.events);
  assert.deepEqual(calls, row.calls);
}
console.log(`PASS: ${notifications.routeRows.length} object-ID/command routes match original x86`);
for (const row of notifications.registryRows) {
  const health = {hp: 37, maxHp: 200};
  const events: typeof row.events = [];
  const registry = new Map([[73, {type: row.recordType, health}]]);
  const handled = routeRegisteredRolePropertyMessage(registry,
    row.messageObjectId, row.messageType, record => routeRolePropertyMessage(
      73, row.messageObjectId, row.command, {
        command3: () => false,
        properties: () => receiveRoleHealthProperties(record.health,
          row.segments.map(bytes => new Uint8Array(bytes)), 0x11223344,
          (index, context) => events.push({index, context, state: {...record.health}})),
        commands6To9: () => false,
      }));
  assert.equal(handled, row.handled);
  assert.deepEqual(events, row.events);
  assert.deepEqual(health, {hp: 37, maxHp: 200});
}
console.log(`PASS: ${notifications.registryRows.length} registry lookups/type gates match original x86`);

interface RegistryState {all: number[]; mode1: number[]; mode2: number[]}
const liveRegistry = createRolePropertyRegistry<{
  objectId: number; mode: number; type: number; health: RoleHealthRecord;
}>();
const registryState = (): RegistryState => ({
  all: [...liveRegistry.all.keys()].sort((a, b) => a - b),
  mode1: [...liveRegistry.mode1.keys()].sort((a, b) => a - b),
  mode2: [...liveRegistry.mode2.keys()].sort((a, b) => a - b),
});
for (const row of notifications.lifecycleRows) {
  const events: typeof row.events = [];
  const attached = (record: {objectId: number}) => events.push({kind: 'attached', objectId: record.objectId, state: registryState()});
  const detached = (record: {objectId: number}) => events.push({kind: 'detached', objectId: record.objectId, state: registryState()});
  const retired = (record: {objectId: number}) => events.push({kind: 'retired', objectId: record.objectId, state: registryState()});
  // Routing evidence was captured after the final insertion and before removal.
  if (row.operation === 'unregister' && liveRegistry.all.size === 5) {
    for (const routeRow of notifications.liveRouteRows) {
      const target = liveRegistry.all.get(routeRow.objectId);
      if (target) target.health = {hp: 37, maxHp: 200};
      const handled = routeRegisteredRolePropertyMessage(liveRegistry[routeRow.table],
        routeRow.objectId, 0x4321, record => routeRolePropertyMessage(record.objectId,
          routeRow.objectId, 5, {
            command3: () => false,
            properties: () => receiveRoleHealthProperties(record.health,
              routeRow.segments.map(bytes => new Uint8Array(bytes)), 0x11223344),
            commands6To9: () => false,
          }));
      assert.equal(handled, routeRow.handled);
      assert.deepEqual(target?.health ?? null, routeRow.result);
    }
  }
  const accepted = row.operation === 'register'
    ? registerRolePropertyRecord(liveRegistry,
      {objectId: row.objectId, mode: row.mode, type: 0x4321, health: {hp: 37, maxHp: 200}}, attached)
    : unregisterRolePropertyRecord(liveRegistry, row.objectId, detached, retired);
  assert.equal(accepted, row.accepted);
  assert.deepEqual(registryState(), row.state);
  assert.deepEqual(events, row.events);
}
console.log('PASS: 15 registry lifecycle operations and 18 live receives match original x86');
for (const present of [false, true]) {
  const registry = createRolePropertyRegistry<{objectId: number; mode: number}>();
  const state = (): RegistryState => ({
    all: [...registry.all.keys()].sort((a, b) => a - b),
    mode1: [...registry.mode1.keys()].sort((a, b) => a - b),
    mode2: [...registry.mode2.keys()].sort((a, b) => a - b),
  });
  for (const row of notifications.eventRows.filter(row => row.observer === present)) {
    const forwarded: typeof row.forwarded = [];
    const listener = present ? {
      attached: (_network: number, record: {objectId: number}, context: number) => {
        forwarded.push({kind: 'attached', objectId: record.objectId, context, state: state()});
      },
      detached: (_network: number, record: {objectId: number}, context: number) => {
        forwarded.push({kind: 'detached', objectId: record.objectId, context, state: state()});
      },
    } : undefined;
    const accepted = row.operation === 'register'
      ? registerRolePropertyRecord(registry, {objectId: row.objectId, mode: row.mode}, record => {
        dispatchRolePropertyEvent(listener, 'attached', 0x200b100, record, 0xabcdef);
      })
      : unregisterRolePropertyRecord(registry, row.objectId, record => {
        dispatchRolePropertyEvent(listener, 'detached', 0x200b100, record, 0xabcdef);
      }, () => {});
    assert.equal(accepted, row.accepted);
    assert.deepEqual(state(), row.state);
    assert.deepEqual(forwarded, row.forwarded);
  }
}
console.log('PASS: 30 real registry event forwarding operations match original x86');

interface CleanupState {
  objectId: number; mode: number; nextFieldIndex: number; nextSecondaryIndex: number;
  fieldCount: number; secondaryCount: number; network: number; metadata: number;
}
for (const row of notifications.cleanupRows) {
  const released: number[] = [];
  const manager = {
    ...row.before,
    fields: Array.from({length: row.before.fieldCount}, (_, index) => ({
      dispose: () => { released.push(index); },
    })),
    secondaryMembers: [],
    network: row.before.network as number | undefined,
    metadata: row.before.metadata as number | undefined,
    owner: {hp: 37, maxHp: 200},
    schemaMode: 2,
    dirtyWords: new Uint32Array([1 << 12, 0, 0, 0, 0, 0, 0, 0]),
    observer: {},
  };
  const owner = manager.owner;
  const observer = manager.observer;
  clearRolePropertyManager(manager);
  assert.deepEqual(released, row.released);
  const after: CleanupState = {
    objectId: manager.objectId, mode: manager.mode,
    nextFieldIndex: manager.nextFieldIndex, nextSecondaryIndex: manager.nextSecondaryIndex,
    fieldCount: manager.fields.length, secondaryCount: manager.secondaryMembers.length,
    network: manager.network ?? 0, metadata: manager.metadata ?? 0,
  };
  assert.deepEqual(after, row.after);
  assert.equal(manager.owner, owner);
  assert.equal(manager.observer, observer);
  assert.equal(manager.schemaMode, 2);
  assert.deepEqual(manager.owner, {hp: 37, maxHp: 200});
  assert.deepEqual([...manager.dirtyWords], [1 << 12, 0, 0, 0, 0, 0, 0, 0]);
}
console.log('PASS: 3 mode1 retirements and 102 property releases match original x86');
for (const row of notifications.retirementRows) {
  const record = {released: false, cleared: false};
  const factories = new Map([[0, (value: typeof record) => { value.released = true; }]]);
  const accepted = retireRolePropertyRecord(record, row.mode, row.type,
    value => { value.cleared = true; }, factories);
  assert.equal(accepted, row.accepted);
  assert.deepEqual(record, {released: row.released, cleared: row.cleared});
}
console.log('PASS: inactive/missing-factory/mode2 retirement dispatch matches original x86');
const factoryEvidence = notifications.registeredFactory;
const factoryRecord = {objectId: 73, mode: 2, type: factoryEvidence.type,
  health: {...factoryEvidence.beforeHealth}, released: false};
const factoryRegistry = createRolePropertyRegistry<typeof factoryRecord>();
assert.equal(registerRolePropertyRecord(factoryRegistry, factoryRecord, () => {}), true);
assert.equal(routeRegisteredRolePropertyMessage(factoryRegistry.mode2, 73, factoryEvidence.type,
  record => routeRolePropertyMessage(record.objectId, 73, 5, {
    command3: () => false,
    properties: () => receiveRoleHealthProperties(record.health,
      [new Uint8Array(factoryEvidence.receivedSegment)], 0x11223344),
    commands6To9: () => false,
  })), true);
assert.deepEqual(factoryRecord.health, factoryEvidence.afterHealth);
assert.equal(unregisterRolePropertyRecord(factoryRegistry, 73, () => {}, record => {
  assert.equal(retireRolePropertyRecord(record, record.mode, record.type, () => {},
    new Map([[record.type, (value: typeof record) => { value.released = true; }]])), true);
}), true);
assert.equal(factoryRecord.released, factoryEvidence.recordFreed);
assert.equal(factoryRegistry.all.size === 0 && factoryRegistry.mode2.size === 0, factoryEvidence.registryEmpty);
console.log('PASS: factory-created record registration, health receive and retirement match original x86');
for (const row of notifications.creationRows) {
  type CreatedRecord = {objectId: number; mode: number; health: RoleHealthRecord; declared: boolean; released: boolean};
  const registry = createRolePropertyRegistry<CreatedRecord>();
  const factories = new Map([[0, {
    create: (): CreatedRecord => ({objectId: 0xffffffff, mode: 0,
      health: {hp: 0, maxHp: 0}, declared: false, released: false}),
    declare: (record: CreatedRecord) => { record.declared = true; },
    bind: (record: CreatedRecord, objectId: number, _metadata: number) => {
      record.objectId = objectId; record.mode = 2;
    },
    release: (record: CreatedRecord) => { record.released = true; },
  }]]);
  const accepted = createRolePropertyRecordFromMessage(registry, 73, row.type,
    row.metadata ? 0x1234 : undefined, factories, record => routeRolePropertyMessage(
      record.objectId, 73, row.command, {
        command3: () => receiveRoleHealthProperties(record.health,
          row.segments.map(bytes => new Uint8Array(bytes)), 0),
        properties: () => false,
        commands6To9: () => false,
      }), () => {});
  assert.equal(accepted, row.accepted);
  const record = registry.all.get(73);
  assert.deepEqual(record?.health ?? null, row.result);
  if (record) {
    assert.equal(record.declared, true);
    assert.equal(unregisterRolePropertyRecord(registry, 73, () => {}, value => {
      factories.get(0)!.release(value);
    }), true);
    assert.equal(record.released, true);
  }
  assert.equal(registry.all.size === 0 && registry.mode2.size === 0, row.registryEmptyAfterRemoval);
}
console.log('PASS: 6 complete creation-message gates and initial health states match original x86');
const dispatchRegistry = createRolePropertyRegistry<{
  objectId: number; mode: number; type: number; health: RoleHealthRecord;
}>();
const dispatchState = (): RegistryState => ({
  all: [...dispatchRegistry.all.keys()], mode1: [...dispatchRegistry.mode1.keys()],
  mode2: [...dispatchRegistry.mode2.keys()],
});
for (const row of notifications.dispatchRows) {
  assert.deepEqual(dispatchState(), row.before);
  const route = (table: 'all' | 'mode1' | 'mode2') => routeRegisteredRolePropertyMessage(
    dispatchRegistry[table], row.objectId, 0, record => routeRolePropertyMessage(
      record.objectId, row.objectId, row.command, {
        command3: () => false,
        properties: () => receiveRoleHealthProperties(record.health,
          [encodeRoleHealthProperty(12, 200)], 0),
        commands6To9: () => false,
      }));
  const accepted = dispatchRoleObjectMessage(row, {
    mode2Contains: key => dispatchRegistry.mode2.has(key),
    command1: () => false,
    create: () => createRolePropertyRecordFromMessage(dispatchRegistry, row.objectId, 0, 0x1234,
      new Map([[0, {
        create: () => ({objectId: 0xffffffff, mode: 0, type: 0, health: {hp: 0, maxHp: 0}}),
        declare: () => {},
        bind: (record, key) => { record.objectId = key; record.mode = 2; },
        release: () => {},
      }]]), record => routeRolePropertyMessage(record.objectId, row.objectId, 3, {
        command3: () => receiveRoleHealthProperties(record.health, [encodeRoleHealthProperty(12, 200)], 0),
        properties: () => false, commands6To9: () => false,
      }), () => {}),
    remove: () => unregisterRolePropertyRecord(dispatchRegistry, row.objectId, () => {}, () => {}),
    mode2: () => route('mode2'),
    all: () => route('all'),
    mode1: () => route('mode1'),
  });
  assert.equal(accepted, row.accepted);
  assert.deepEqual(dispatchState(), row.after);
}
console.log('PASS: 12 upper object command/category/recipient dispatches match original x86');

for (const row of notifications.packetRows) {
  const raw = new Uint8Array(row.raw);
  const message = readRoleNetworkMessage(raw);
  assert.deepEqual([...message.bytes], row.bytes);
  assert.deepEqual([...message.payload], row.payload);
  assert.deepEqual([...raw], row.raw);
}
console.log('PASS: 6 raw packet copies and payload-length rewrites match original x86');
const inletRegistry = createRolePropertyRegistry<{
  objectId: number; mode: number; type: number; health: RoleHealthRecord;
}>();
const inletState = (): RegistryState => ({
  all: [...inletRegistry.all.keys()], mode1: [...inletRegistry.mode1.keys()],
  mode2: [...inletRegistry.mode2.keys()],
});
for (const row of notifications.inletRows) {
  assert.deepEqual(inletState(), row.before);
  const message = readRoleNetworkMessage(new Uint8Array(row.raw));
  const events: string[] = [];
  dispatchRoleNetworkMessage(message, () => {
    events.push('state');
    return row.networkState;
  }, {
    category1: () => { events.push('category1'); },
    category2: () => { events.push('category2'); },
    category3: () => {
      events.push('category3');
      // These inlet fixtures contain one original numeric property segment.
      assert.equal(message.propertyCount, 1);
      const receive = (health: RoleHealthRecord) => receiveRoleHealthProperties(
        health, [message.payload], message.context);
      const route = (table: 'all' | 'mode1' | 'mode2') => routeRegisteredRolePropertyMessage(
        inletRegistry[table], message.objectId, message.type,
        record => routeRolePropertyMessage(record.objectId, message.objectId, message.command, {
          command3: () => receive(record.health), properties: () => receive(record.health),
          commands6To9: () => false,
        }));
      dispatchRoleObjectMessage(message, {
        mode2Contains: key => inletRegistry.mode2.has(key),
        command1: () => false,
        create: () => createRolePropertyRecordFromMessage(
          inletRegistry, message.objectId, message.type, message.metadataType,
          new Map([[0, {
            create: () => ({objectId: 0xffffffff, mode: 0, type: 0, health: {hp: 0, maxHp: 0}}),
            declare: () => {},
            bind: (record, key) => { record.objectId = key; record.mode = 2; },
            release: () => {},
          }]]), record => routeRolePropertyMessage(record.objectId, message.objectId, message.command, {
            command3: () => receive(record.health), properties: () => receive(record.health),
            commands6To9: () => false,
          }), () => {}),
        remove: () => unregisterRolePropertyRecord(inletRegistry, message.objectId, () => {}, () => {}),
        mode2: () => route('mode2'), all: () => route('all'), mode1: () => route('mode1'),
      });
    },
  });
  assert.deepEqual(events, row.events);
  assert.deepEqual(inletState(), row.after);
  assert.deepEqual(inletRegistry.all.get(message.objectId)?.health ?? null, row.result);
}
console.log('PASS: 84 network inlet gates, category dispatches and raw-packet health lifecycle match original x86');

const littleEndianArray = (values: number[], width: 1 | 2 | 4): Uint8Array => {
  const bytes = new Uint8Array(values.length * width);
  const view = new DataView(bytes.buffer);
  values.forEach((value, slot) => {
    if (width === 1) view.setUint8(slot, value);
    else if (width === 2) view.setUint16(slot * width, value, true);
    else view.setUint32(slot * width, value, true);
  });
  return bytes;
};
for (const row of notifications.arrayWireRows) {
  const field: RoleArrayProperty = {
    width: row.width, count: row.count, bytes: littleEndianArray(row.values, row.width),
    snapshot: littleEndianArray(row.baseline, row.width),
  };
  assert.deepEqual([...encodeRoleArrayProperty(row.index, field, row.mode)], row.bytes);
  assert.deepEqual([...field.snapshot], [...littleEndianArray(row.baseline, row.width)]);
}
const skillCatalog = new Map(notifications.arraySkillCatalog.map(skill => [skill.skillId, skill]));
const receivedSourceSkills = new Set<number>();
for (const row of notifications.arrayReceiveRows) {
  const state = createRoleCombatState();
  state.dirty = false;
  const fieldWidths = new Map<number, 1 | 4>([[28, 4], [29, 4], [30, 4], [31, 4], [32, 4], [33, 1]]);
  const fields = new Map<number, RoleArrayProperty>();
  for (const [key, values] of Object.entries(row.before)) {
    const index = Number(key);
    const width = fieldWidths.get(index)!;
    const boundArray = index === 28 ? state.record!.arrays.get(0)
      : index === 29 ? state.record!.arrays.get(1)
      : index === 30 ? state.record!.arrays.get(2)
      : index === 31 ? state.record!.arrays.get(4)
      : index === 33 ? state.record!.flags : new Int32Array(3);
    const bytes = new Uint8Array(boundArray!.buffer, boundArray!.byteOffset, boundArray!.byteLength);
    bytes.set(littleEndianArray(values, width));
    fields.set(index, {width, count: values.length, bytes, snapshot: bytes.slice()});
  }
  const snapshot = new Map([...fields].map(([index, field]) => [index, [...field.snapshot]]));
  const arrays = (): Record<string, number[]> => Object.fromEntries([...fields].map(([index, field]) => {
    const view = new DataView(field.bytes.buffer, field.bytes.byteOffset, field.bytes.byteLength);
    return [index, Array.from({length: field.count}, (_, slot) => field.width === 1
      ? view.getUint8(slot) : view.getUint32(slot * 4, true))];
  }));
  const events: typeof row.events = [];
  assert.equal(receiveRoleArrayProperties(fields, row.segments.map(bytes => new Uint8Array(bytes)),
    0x11223344, row.observer ? (index, context) => {
      events.push({index, context, arrays: arrays()});
    } : undefined), row.accepted);
  assert.deepEqual(arrays(), row.result);
  assert.deepEqual(events, row.events);
  assert.equal(state.dirty, false, 'Network field reception itself does not run role setter/recompute');
  for (const [index, field] of fields) assert.deepEqual([...field.snapshot], snapshot.get(index));
  // Receive into the actual state slots, then use the production skill-source selector.
  const selected = selectRoleSkills({currentSkillIds: [...state.record!.arrays.get(4)!],
    extraSkill: {baseId: 0, rank: 0}}, skillCatalog);
  const expected = row.result['31'].filter(id => skillCatalog.has(id));
  assert.deepEqual(selected.map(skill => skill.skillId), expected);
  for (const id of expected) receivedSourceSkills.add(id);
}
assert.equal(receivedSourceSkills.size, 342);
console.log(`PASS: ${notifications.arrayWireRows.length} original array encodings and ${notifications.arrayReceiveRows.length} receives; all342 source skill IDs reach production selection`);
