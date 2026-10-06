import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {requestKitbagAssignment, requestKitbagCancellation} from '../../../apps/server/src/accounts/kitbag-configuration';
import {applyKitbagAssignment, applyKitbagCancellation} from '../../../apps/server/src/battle/items/kitbag-confirmation';
import {createRoleCombatState, RoleCombatState} from '../../../apps/server/src/battle/roles/combat-state';
import type {BattleItemRecord} from '../../../apps/shared/combat/item-hotkeys';
import {initializeBattleQuantities, resolveItemHotkey} from '../../../apps/shared/combat/item-hotkeys';
import {decodeKitbagAssignment, decodeKitbagCancellation, encodeKitbagAssignment,
  encodeKitbagCancellation, KITBAG_ASSIGNMENT_MESSAGE_TYPE,
  KITBAG_CANCELLATION_MESSAGE_TYPE} from './kitbag-configuration-wire';

interface State {hotkeys: number[]; dirty: boolean;}
interface Notice {kind: 'ui' | 'role'; code: number; state: State;}
interface Sent {kind: 'assign' | 'cancel'; instanceId?: number; slot: number;}
interface Result {accepted?: boolean; sent: Sent[]; notices: Notice[]; state: State;}
const oracle = JSON.parse(readFileSync('recovery/output/kitbag-configuration-native.json', 'utf8')) as {
  requests: {itemId: number; group: number; instanceId: number; slot: number; found?: boolean; result: Result}[];
  cancellations: {slot: number; initial: State; result: Result}[];
  confirmations: {kind: 'assign' | 'cancel'; result: number; role: boolean; array: boolean; ui: boolean; resultState: Result}[];
  wire: {kind: 'assign' | 'cancel'; messageType: number; values: number[]; actual: number[]; bitOffset: number; payload: string}[];
};
function fixture(hasArray = true, hasUi = true, hotkeys = [1, 2, 3, 4, 5, 6, 7]) {
  const record = createRoleCombatState().record!;
  record.arrays.set(0, Int32Array.from(hotkeys));
  const notices: Notice[] = [], sent: Sent[] = [];
  const state = () => ({hotkeys: [...record.arrays.get(0)!], dirty: role.dirty});
  const role = new RoleCombatState(hasArray ? record : undefined,
    code => notices.push({kind: 'role', code, state: state()}));
  role.dirty = false;
  const notify = hasUi ? (code: number) => notices.push({kind: 'ui', code, state: state()}) : undefined;
  return {role, record, notify, sent, result: (accepted?: boolean): Result =>
    ({...(accepted === undefined ? {} : {accepted}), sent, notices, state: state()})};
}
for (const row of oracle.requests) {
  const f = fixture();
  const groups: BattleItemRecord[][] = Array.from({length: 8}, () => []);
  const record = {instanceId: 77, itemTableId: row.itemId, ownedQuantity: 0, battleQuantity: 0};
  if (row.found !== false) groups[row.group].push(record);
  const accepted = requestKitbagAssignment(groups, row.instanceId, row.slot,
    request => f.sent.push({kind: 'assign', ...request}), f.notify);
  assert.deepEqual(f.result(accepted), row.result);
  assert.deepEqual([record.ownedQuantity, record.battleQuantity], [0, 0]);
}
for (const row of oracle.cancellations) {
  const f = fixture(true, true, row.initial.hotkeys);
  const accepted = requestKitbagCancellation(f.record.arrays.get(0)!, row.slot,
    slot => f.sent.push({kind: 'cancel', slot}), f.notify);
  assert.deepEqual(f.result(accepted), row.result);
}
for (const row of oracle.confirmations) {
  const f = fixture(row.array, row.ui);
  const role = row.role ? f.role : undefined;
  if (row.kind === 'assign') applyKitbagAssignment(role,
    {result: row.result, instanceId: 77, slot: 2, hotkeys: [77, 0, 0xffffffff, 4, 5, 6, 7]}, f.notify);
  else applyKitbagCancellation(role, {result: row.result, slot: 3}, f.notify);
  assert.deepEqual(f.result(), row.resultState);
}
for (const row of oracle.wire) {
  const bytes = Buffer.from(row.payload, 'hex');
  if (row.kind === 'assign') {
    assert.equal(row.messageType, KITBAG_ASSIGNMENT_MESSAGE_TYPE);
    const [result, instanceId, slot, ...hotkeys] = row.values;
    assert.equal(Buffer.from(encodeKitbagAssignment({result, instanceId, slot, hotkeys}, row.bitOffset)).toString('hex'), row.payload);
    const [expectedResult, expectedId, expectedSlot, ...expectedHotkeys] = row.actual;
    assert.deepEqual(decodeKitbagAssignment(bytes, row.bitOffset),
      {result: expectedResult, instanceId: expectedId, slot: expectedSlot, hotkeys: expectedHotkeys});
  } else {
    assert.equal(row.messageType, KITBAG_CANCELLATION_MESSAGE_TYPE);
    assert.equal(Buffer.from(encodeKitbagCancellation({slot: row.values[0], result: row.values[1]}, row.bitOffset)).toString('hex'), row.payload);
    assert.deepEqual(decodeKitbagCancellation(bytes, row.bitOffset), {slot: row.actual[0], result: row.actual[1]});
  }
}

// Request -> authoritative seven-slot confirmation -> normal battle-key dispatch.
const f = fixture(true, true, [0, 0, 0, 0, 0, 0, 0]);
const trap = {instanceId: 77, itemTableId: 3001, ownedQuantity: 3, battleQuantity: 0};
const groups: BattleItemRecord[][] = Array.from({length: 8}, () => []);
groups[1].push(trap);
assert(requestKitbagAssignment(groups, 77, 1, request => f.sent.push({kind: 'assign', ...request})));
assert.deepEqual([...f.record.arrays.get(0)!], [0, 0, 0, 0, 0, 0, 0], 'Sending configuration must not apply it');
const confirmation = {result: 4, instanceId: 77, slot: 1, hotkeys: [77, 0, 0, 0, 0, 0, 0]};
applyKitbagAssignment(f.role, decodeKitbagAssignment(encodeKitbagAssignment(confirmation)));
initializeBattleQuantities(f.record.arrays.get(0)!, [trap], () => 2);
assert.deepEqual(resolveItemHotkey(2, true, f.record.arrays.get(0), [trap]).command, {kind: 'placeTrap', instanceId: 77});
applyKitbagCancellation(f.role, decodeKitbagCancellation(encodeKitbagCancellation({slot: 1, result: 1})));
assert.deepEqual(resolveItemHotkey(2, true, f.record.arrays.get(0), [trap]).command, {kind: 'none'});
assert.deepEqual([trap.ownedQuantity, trap.battleQuantity], [3, 2]);
console.log(`PASS: ${oracle.requests.length} assignments, ${oracle.cancellations.length} cancellations, ${oracle.confirmations.length} confirmations and ${oracle.wire.length} packets match original; confirmed slots drive normal hotkeys`);
