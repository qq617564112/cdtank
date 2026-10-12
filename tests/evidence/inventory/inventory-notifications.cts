import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import type {BattleItemRecord} from '../../../apps/shared/combat/item-hotkeys';
import {applyKitbagDeletion} from './inventory-notifications';
import {decodeKitbagDeletion, encodeKitbagDeletion} from './inventory-wire';

interface QuantityNotification {
  instanceId: number;
  battleQuantity: number;
}

interface NativeRow {
  vectors: [BattleItemRecord[], BattleItemRecord[]];
  instanceId: number;
  observer: boolean;
  payload: string;
  bitOffset: number;
  result: {vectors: [BattleItemRecord[], BattleItemRecord[]]; callbacks: QuantityNotification[]};
}

const evidence: {rows: NativeRow[]} = JSON.parse(readFileSync(
  'recovery/output/inventory-notifications-native.json', 'utf8'));
for (const row of evidence.rows) {
  const vectors = structuredClone(row.vectors);
  const callbacks: QuantityNotification[] = [];
  let callbackState: [BattleItemRecord[], BattleItemRecord[]] | undefined;
  const instanceId = decodeKitbagDeletion(Buffer.from(row.payload, 'hex'), row.bitOffset);
  assert.equal(instanceId, row.instanceId);
  assert.equal(Buffer.from(encodeKitbagDeletion(row.instanceId, row.bitOffset)).toString('hex'), row.payload);
  applyKitbagDeletion({primary: vectors[0], secondary: vectors[1]}, instanceId,
    row.observer ? (instanceId, battleQuantity) => {
      callbacks.push({instanceId, battleQuantity});
      callbackState = structuredClone(vectors);
    } : undefined);
  assert.deepEqual(vectors, row.result.vectors);
  assert.deepEqual(callbacks, row.result.callbacks);
  if (callbacks.length) assert.deepEqual(callbackState, row.result.vectors,
    'Both quantities must be updated before the observer is notified');
}
console.log(`PASS: ${evidence.rows.length} native inventory notifications, first-match precedence, quantities and callback ordering`);
