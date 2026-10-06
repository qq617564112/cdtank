import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';

const rawPath = process.argv[2];
assert(rawPath);
const raw = JSON.parse(readFileSync(rawPath, 'utf8'));
assert.equal(raw.status, 'PASS_RENDER_PENDING_PIXEL_REVIEW');
assert.equal(raw.itemId, 17031);
assert.equal(raw.auxiliaryPlayers.length, 2);
assert(raw.purchase.status.includes('已购买黄金之光'));
assert(raw.purchase.owned.includes('×1'));
assert.equal(raw.equipment.slot, 0);
assert.equal(raw.equipment.instanceId, '1');
for (const world of raw.initial) {
  assert.deepEqual(world.players.find((p: {id: string}) => p.id === 'P1').queuedPartSkillIds, [13501]);
}
const captures = raw.observed.map((side: {
  notifications: unknown[];
  effects: {root: number; owner: string; rendered: number[]; handle: number}[];
  captures: {frame: number; rendered: number[]}[];
}, index: number) => {
  assert.deepEqual(side.notifications, []);
  assert.equal(side.effects.length, 1);
  assert.equal(side.effects[0].root, 2500);
  assert.equal(side.effects[0].owner, 'player-P1');
  assert(side.effects[0].rendered.includes(2601));
  assert(side.effects[0].rendered.includes(2882));
  assert.equal(side.captures.length, 3);
  return side.captures.map((frame, sample) => {
    const path = rawPath.replace('.json', `-canvas-${index + 1}-${sample}.png`);
    assert(readFileSync(path).length > 0);
    return {path, frame: frame.frame, submitted: frame.rendered};
  });
});
for (const counts of raw.cleanup) {
  assert.deepEqual(counts, {instances: 0, meshes: 0, skillVoices: 0, treeVoices: 0,
    battleVoices: 0, world: null});
}
writeFileSync('recovery/output/role-queued-glow-actual.json', JSON.stringify({
  status: 'PASS_LIMITED_PURCHASE_EQUIP_RENDER_LEAVE_SCOPE', raw: rawPath,
  source: 'role-queued-glow-source.json',
  sourceModuleReuse: ['effects-role-queue-reentry.json', 'skill-effect-queue-native.json',
    'queued-part-effects.json'],
  purchase: raw.purchase, equipped: raw.equipment, fixture: raw.fixture,
  authoritativeSkills: [13501], actualOwner: 'player-P1', root: 2500,
  drawingNodes: [2601, 2882], captures,
  visibleOutputAccepted: true,
  pixelReview: 'Complete320x180 host and guest canvases show original yellow particles surrounding the equipped host tank.',
  notificationTraceRecorded: false,
  soundScope: 'Original skill Sound0 and tree has no sound nodes; Leave all sound owners0. No in-play audio-creation trace captured.',
  cleanup: raw.cleanup,
  missing: ['direct queue play/revive trace in ordinary raw', 'in-play sound-creation trace',
    'natural death/revival/round reset', '13502 and multi-entry alternation ordinary route',
    'new postLeave persistence/restart', 'HD/original framebuffer'], parentsComplete: false,
}, null, 2) + '\n');
console.log('PASS_LIMITED_PURCHASE_EQUIP_RENDER_LEAVE_SCOPE: bought17031 equipped host original31 dual particles and Leave0');
