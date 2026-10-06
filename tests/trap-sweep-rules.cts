import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import type {GroundTrapSnapshot} from '../apps/shared/protocols';
import {readTrapSweepRule, selectSweepTraps} from '../apps/server/src/battle/items/trap-sweep';

assert.deepEqual(readTrapSweepRule(), {itemTableId: 12, skillId: 12, radius: 400});
const center = {x: 20, z: -30};
function trap(id: string, x: number, z: number, expiresAt = 2000,
    ownerId = 'P1', team = 0): GroundTrapSnapshot {
  return {id, ownerId, team, itemTableId: 3003, modelId: 3003,
    x, y: 0, z, expiresAt};
}
const rows: unknown[] = [];
const inputs = [trap('center', 20, -30), trap('boundary', 260, 290),
  trap('outside', 260, 290.01), trap('expired', 20, -30, 1000),
  trap('self', 20, -30, 2000, 'P2', 1), trap('enemy', 20, -30, 2000, 'P3', 2)];
inputs[0].y = 500;
const before = JSON.stringify(inputs);
const selected = selectSweepTraps(inputs, center, 1000, readTrapSweepRule()!.radius);
assert.deepEqual(selected.map(row => row.id), ['center', 'boundary', 'self', 'enemy']);
assert.equal(JSON.stringify(inputs), before);
assert(selected.every(row => inputs.includes(row)), 'Selection preserves exact object identities/order');
rows.push({scenario: 'XZ-inclusive400/expired/all-owners-and-teams', selected: selected.map(row => row.id)});
assert.deepEqual(selectSweepTraps([], center, 1000, 400), []);
rows.push({scenario: 'empty', selected: []});
assert.deepEqual(selectSweepTraps(inputs, center, 2000, 400), []);
rows.push({scenario: 'deadline-inclusive-expiry', selected: []});
const unknown = {...trap('other', 20, -30), itemTableId: 3002} as GroundTrapSnapshot;
assert.deepEqual(selectSweepTraps([unknown], center, 1000, 400), []);
rows.push({scenario: 'unimplemented-other-ground', selected: []});
const hpAndState = {hp: 655, trapRestraint: {skillId: 4001, expiresAt: 6000}, buff: 6};
const original = JSON.stringify(hpAndState);
selectSweepTraps(inputs, {...center, ...hpAndState}, 1000, 400);
assert.equal(JSON.stringify(hpAndState), original);
rows.push({scenario: 'no-health-restraint-or-buff-write'});
writeFileSync('recovery/output/trap-sweep-rules.json', JSON.stringify({
  status: 'PASS_PURE_SELECTOR_ONLY', rule: readTrapSweepRule(), rows,
  scope: 'Rebuilt radius and active current3003 selection; no inventory, CAS, ground mutation, original server semantics or actual network acceptance.',
}, null, 2) + '\n');
console.log('PASS: original12/14 source rule; inclusive XZ400, all owners/teams, expiry/empty/unsupported, identity/order and no mutation');
