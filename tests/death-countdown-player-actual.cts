import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
const raw = process.argv[2], evidence = JSON.parse(readFileSync(raw, 'utf8'));
assert.equal(evidence.status, 'INCOMPLETE');
assert(evidence.failures.every((s: string) => s.startsWith('side0')));
assert.equal(evidence.cpuClicks.length, 2);
assert(evidence.cpuClicks.every((r: any) => r.matched && !r.disabled));
assert.equal(evidence.cpuRequests.length, 2);
assert(evidence.cpuRequests.every((r: any) => r.success && r.request.operation === 'ADD'));
const rows = evidence.rows[1];
const values = rows.filter((r: any) => r.visible && r.value);
for (const [value, asset] of [['5', '/ui/regions/4/4.png'], ['4', '/ui/regions/4/3.png']]) {
  assert(values.some((r: any) => r.alive === false && r.value === value && r.font === 'Countdown'
    && r.glyphs.some((g: any) => g.src === asset && g.complete && g.natural[0] === 50 && g.natural[1] === 70)));
}
assert(rows.some((r: any, i: number) => r.alive && !r.visible && rows.slice(0, i).some((p: any) => !p.alive && p.visible)));
assert.equal(evidence.capture1.row.value, '5'); assert.equal(evidence.capture1.row.alive, false);
assert(evidence.cleanup.every((r: any) => !r.world && !r.visible && !r.value));
writeFileSync('recovery/output/death-countdown-player-actual.json', JSON.stringify({status: 'PASS_LIMITED_LOCAL_PLAYER_SCOPE',
  tasklist: 'M2-05', raw, originalStatusPreserved: 'INCOMPLETE', acceptedLocal: 'P2',
  capture: raw.replace('.json', '-natural-2.png'), ordinaryInput: 'two strict normal CPU clicks and requests; formal Ready; natural CPU death',
  visibleGlyphsVerified: ['5', '4'], otherObservedGlyphs: ['3 only DOM at authoritative revive boundary'],
  lifecycle: ['natural fullHP revive hides', 'dual normal Leave clears'],
  missing: ['host local death not exercised', 'glyph1/2 not reached before actual3sec respawn',
    '3 independent visible canvas not captured', 'full original respawn/server policy', 'HD/all original states']}, null, 2) + '\n');
console.log('PASS limited P2 natural death Countdown5/4, revive and dual Leave; preserve overall INCOMPLETE');
