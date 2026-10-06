import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';

const rawPath = 'recovery/output/browser-role-movement-dust-2026-10-05T01-20-13-111Z.json';
const raw = JSON.parse(readFileSync(rawPath, 'utf8'));
assert.equal(raw.status, 'PASS_RENDER_PENDING_PIXEL_REVIEW');
assert.equal(raw.mapId, 7);
const pages = raw.observed.map((observed: any, index: number) => {
  const starts = observed.starts.filter((row: any) => row.owner === 'player-P1');
  assert.ok(starts.length > 1);
  assert.equal(new Set(starts.map((row: any) => row.handle)).size, 1);
  assert.ok(starts.every((row: any) => row.after === 1));
  assert.equal(observed.soundStarts.length, 0);
  const rendered = observed.effects.find((row: any) => row.owner === 'player-P1');
  assert.deepEqual([...rendered.rendered].sort((a: number, b: number) => a-b), [2425, 2455, 2815, 2816]);
  const tail = raw.tail[index].effects.find((row: any) => row.owner === 'player-P1');
  const particles = tail.nodes.filter((node: any) => node.particles !== null);
  assert.equal(particles.length, 4);
  assert.ok(particles.every((node: any) => node.phase === 3 && node.particles === 0));
  assert.equal(tail.handle, starts[0].handle);
  const cleanup = raw.cleanup[index];
  assert.deepEqual(cleanup, {instances: 0, meshes: 0, skillVoices: 0, treeVoices: 0, battleVoices: 0, world: null});
  const before = raw.initial[index].players.find((player: any) => player.id === 'P1');
  const after = raw.afterMovement[index].players.find((player: any) => player.id === 'P1');
  assert.ok(Math.hypot(before.x-after.x, before.z-after.z) > 1);
  return {starts: starts.length, handle: tail.handle, rendered: rendered.rendered,
    soundStarts: 0, naturalTailParticleCounts: particles.map((node: any) => node.particles), cleanup};
});
writeFileSync('recovery/output/role-movement-dust-actual.json', JSON.stringify({
  status: 'PASS_NORMAL_MOVEMENT_TRIGGER_DRAW_SILENCE_TAIL_LEAVE_ONLY', raw: rawPath, pages,
  visibleAccepted: false,
  scope: 'Normal map7/mode1 four accounts, two React native W movement. Pre-room native tank1/pet1 ownership fixture disclosed. Same retained001 per role, four actual draw nodes, original silence, natural tail and Leave. First320x180 canvases do not establish distinct smoke pixels; HD/death/respawn/rematch and low-HP smoke unverified.',
}, null, 2) + '\n');
console.log('PASS: ordinary movement001 dual trigger/draw/silence/tail/Leave; pixels open');
