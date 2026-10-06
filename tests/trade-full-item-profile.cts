import assert from 'node:assert/strict';
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {AccountStore} from '../apps/server/src/account-store';

const directory = mkdtempSync(join(tmpdir(), 'trade-full-item-'));
const accounts = new AccountStore(join(directory, 'accounts.sqlite'));
try {
  const a = accounts.open(), b = accounts.open();
  for (const id of [a.accountId, b.accountId]) {
    const bytes = new Uint8Array(0x170), view = new DataView(bytes.buffer);
    view.setUint32(0x118, 1, true);
    view.setUint32(0x11c, 1, true);
    accounts.replaceRoleProfile(id, {bytes, strings: ['', '']});
  }
  accounts.replaceInventory(a.accountId, [{instanceId: 1, itemTableId: 13001, ownedQuantity: 1,
    battleQuantity: 0, state: 0, field8: 0, float24Bits: 0, float28Bits: 0, float2cBits: 0}]);
  const offer = {money: 0, originality: 0, skillPoints: 0, records: [{kind: 'item' as const, instanceId: 1}]};
  accounts.settleTrade('whole-item-profile', [a.accountId, b.accountId], [accounts.prepareTrade(a.accountId, offer),
    accounts.prepareTrade(b.accountId, {...offer, records: []})]);
  const donor = accounts.tradeAccount(a.accountId);
  const view = new DataView(Uint8Array.from(donor.profile!.bytes).buffer);
  assert.equal(view.getUint32(0x118, true), 0);
  assert.equal(view.getUint32(0x11c, true), 1);
  assert.equal(donor.inventory.records.length, 0);
  assert.equal(accounts.tradeAccount(b.accountId).inventory.records[0].itemTableId, 13001);
  writeFileSync('recovery/output/trade-full-item-profile.json', JSON.stringify({
    status: 'PASS_FULL_ITEM_TRANSFER_KNOWN_REFERENCE_CLEAR_OTHER_PROFILE_PRESERVED', fixtureOnly: true,
    clearedOffset: 0x118, preservedOffset: 0x11c}, null, 2) + '\n');
} finally {accounts.close(); rmSync(directory, {recursive: true, force: true});}
