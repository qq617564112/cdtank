import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {evaluateRoleTankTextureRequest} from '../../../apps/server/src/accounts/tank-texture-change';
const native = JSON.parse(readFileSync('recovery/output/role-texture-transfer-sol-native.json', 'utf8'));
const current = {U: 71, M: 72, XY: 73};
for (const row of native.requests) {
  const actual = evaluateRoleTankTextureRequest(current, {U: 0, M: row.textureId, XY: 0},
    row.money, row.tokens, id => {
      assert.equal(id, row.textureId);
      return {rarity: row.rarity, moneyPrice: row.moneyPrice, tokenPrice: row.tokenPrice};
    });
  assert.equal(actual.send, row.sent.length === 1, `Send ${row.textureId}`);
  assert.equal(actual.result, row.events[0]?.result, `Result ${row.textureId}`);
}
assert.equal(evaluateRoleTankTextureRequest(current, current, 0, 0, () => {
  throw new Error('Unchanged original selection must not query a table');
}).result, 0);
assert.equal(evaluateRoleTankTextureRequest(current, {U: 0, M: 0, XY: 0}, 0, 0, () => {
  throw new Error('Zero original selection must not query a table');
}).result, 0);
// Original493cca/493ce5 use JAE: high-bit imported balances remain unsigned.
for (const [money, tokens] of [[0x80000000, 0x80000000], [0xffffffff, 0xffffffff],
  [-0x80000000, -0x80000000], [-1, -1]]) {
  assert.equal(evaluateRoleTankTextureRequest(current, {U: 0, M: 11012, XY: 0},
    money, tokens, () => ({rarity: 2, moneyPrice: 500, tokenPrice: 50})).send, true);
}
const highCurrent = {U: 0xffffffff, M: 0x80000000, XY: 0xf1234567};
assert.equal(evaluateRoleTankTextureRequest(highCurrent,
  {U: -1, M: -0x80000000, XY: 0xf1234567 | 0}, 0, 0, () => {
    throw new Error('Equal DWORDs must not query a table');
  }).result, 0);
console.log(`PASS: ${native.requests.length} original table request gates and source currency checks`);
