import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {requestItemUse, requestTrapPlacement} from '../apps/server/src/battle/items/item-use';

interface NativeRow {
  kind: 'use' | 'trap';
  itemId: number;
  quantity: number;
  secondary?: boolean;
  status?: number;
  permission?: number;
  role?: boolean;
  array?: boolean;
  assigned?: boolean;
  found?: boolean;
  scene?: boolean;
  game_mode?: number;
  result: {sent: {instanceId: number; trapPermission: number}[]; trapPermission: number; accepted?: boolean};
}
const evidence: {rows: NativeRow[]} = JSON.parse(readFileSync('recovery/output/item-use-native.json', 'utf8'));
for (const row of evidence.rows) {
  const record = {instanceId: 77, itemTableId: row.itemId, ownedQuantity: 999, battleQuantity: row.quantity};
  const records = row.found === false ? [] : [record];
  const inventory = {primary: row.secondary ? [] : records, secondary: row.secondary ? records : []};
  const state = {status: row.status ?? 2, trapPermission: row.permission ?? 1};
  const role = row.role === false ? undefined : state;
  const sent: {instanceId: number; trapPermission: number}[] = [];
  const send = (instanceId: number) => sent.push({instanceId, trapPermission: state.trapPermission});
  if (row.kind === 'use') {
    assert.equal(requestItemUse(role, inventory, 77, send), row.result.accepted);
  } else {
    requestTrapPlacement({engineMode: row.game_mode ?? 4, role,
      hotkeys: row.array === false ? undefined : new Int32Array(7).fill(row.assigned === false ? 0 : 77),
      scenePresent: row.scene !== false, controllerPresent: true}, inventory, 77, send);
  }
  assert.deepEqual(sent, row.result.sent, 'Request and permission state at the exact send boundary');
  assert.equal(state.trapPermission, row.result.trapPermission);
  assert.equal(record.ownedQuantity, 999);
  assert.equal(record.battleQuantity, row.quantity, 'Request cannot consume an owned record');
}
console.log(`PASS: ${evidence.rows.length} original use/trap decisions, status distinction, permission clear ordering and quantity preservation`);
