import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRoleCombatState, RoleCombatState} from '../apps/server/src/battle/roles/combat-state';
import {requestItemUse} from '../apps/server/src/battle/items/item-use';

interface NativeRow {
  flagTime: number;
  trapTime: number;
  permission: number;
  delta: number;
  result: {flag8Seconds: number; flag8: number; trapPermission: number; trapCountdown: number; notifications: number[]};
}
const evidence: {rows: NativeRow[]} = JSON.parse(readFileSync('recovery/output/role-item-timers-native.json', 'utf8'));
for (const row of evidence.rows) {
  const record = createRoleCombatState().record!;
  record.flags[8] = 1;
  const notifications: number[] = [];
  const state = new RoleCombatState(record, index => notifications.push(index));
  state.flag8Seconds = row.flagTime;
  state.trapCountdown = row.trapTime;
  state.trapPermission = row.permission;
  state.advanceTimers(row.delta);
  assert.deepEqual({flag8Seconds: state.flag8Seconds, flag8: record.flags[8],
    trapPermission: state.trapPermission, trapCountdown: state.trapCountdown, notifications}, row.result);
}
const state = createRoleCombatState();
state.setStatus(2);
const trap = {instanceId: 77, itemTableId: 3001, ownedQuantity: 3, battleQuantity: 3};
const inventory = {primary: [trap], secondary: []};
let requests = 0;
const send = () => requests++;
assert(requestItemUse(state, inventory, 77, send));
assert.equal(state.trapPermission, 0);
assert.equal(requestItemUse(state, inventory, 77, send), false);
state.advanceTimers(3);
assert.equal(state.trapPermission, 1);
assert(requestItemUse(state, inventory, 77, send));
assert.equal(requests, 2);
assert.equal(trap.battleQuantity, 3);
console.log(`PASS: ${evidence.rows.length} original role timer updates, observer calls and zero-boundary distinctions`);
