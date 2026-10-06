import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {roleAmmoEffectName, roleAmmoActionEffectName} from '../apps/web/src/assets/tanks/role-ammo-visual';
const evidence: {rows: {action: boolean; event: boolean; count: number; value: number;
  name: string; written: number[]}[]} = JSON.parse(readFileSync('recovery/output/role-ammo-visual-native.json', 'utf8'));
for (const row of evidence.rows) {
  const name = roleAmmoEffectName(row.value);
  assert.equal(name, row.name);
  const outputs = Array.from({length: 3}, (_, index) => row.action && row.event && index < row.count
    ? roleAmmoActionEffectName('03', 'attack1', 'old', name) : 'old');
  assert.deepEqual(outputs.map(value => value === 'old' ? 0xaaaaaaaa : 99), row.written);
  for (const [action, event] of [['01', 'attack1'], ['03', 'attack2'], ['09', 'attack1']]) {
    assert.equal(roleAmmoActionEffectName(action, event, 'old', name), 'old');
  }
  assert.equal(roleAmmoActionEffectName('03', 'attack1', 'old', undefined), 'old');
}
console.log(`PASS: ${evidence.rows.length} native ammo-effect names, all03/attack1 records and unrelated-event preservation`);
