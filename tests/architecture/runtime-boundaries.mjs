import assert from 'node:assert/strict';
import {existsSync, readFileSync, readdirSync} from 'node:fs';
import {dirname, relative, resolve} from 'node:path';

const workspace = resolve('.');
const visited = new Set();
function visit(file) {
  if (visited.has(file)) return;
  visited.add(file);
  const path = relative(workspace, file).replaceAll('\\', '/');
  assert(!path.startsWith('recovery/evidence/') && !path.startsWith('tests/') && !path.startsWith('tools/'),
    `Runtime imports verification code: ${path}`);
  assert(!path.includes('render-check'), `Runtime imports rendering validation: ${path}`);
  const source = readFileSync(file, 'utf8');
  const references = source.matchAll(/(?:from\s*|import\s*\(\s*|import\s*)['"]([^'"]+)['"]/g);
  for (const [, reference] of references) {
    if (!reference.startsWith('.')) continue;
    const target = resolve(dirname(file), reference);
    const resolved = [target, `${target}.ts`, `${target}.tsx`, `${target}.cts`, `${target}.js`, resolve(target, 'index.ts'), resolve(target, 'index.tsx')]
      .find(candidate => existsSync(candidate));
    assert(resolved, `Unresolved runtime dependency: ${path} -> ${reference}`);
    if (/\.(?:ts|tsx|cts|js)$/.test(resolved)) visit(resolved);
  }
}
for (const entry of ['apps/server/src/index.ts', 'apps/web/src/main.ts']) visit(resolve(entry));
for (const name of ['item-request-dispatch', 'item-use', 'role-ammo-request']) {
  assert(!existsSync(`apps/shared/combat/${name}.ts`));
  assert(existsSync(`apps/server/src/battle/items/${name}.ts`));
}
assert(!existsSync('apps/shared/combat/inventory-notifications.ts'));
assert(existsSync('apps/server/src/battle/items/inventory.ts'));
assert(existsSync('recovery/evidence/inventory/inventory-notifications.ts'));
assert(!existsSync('apps/shared/combat/inventory-wire.ts'));
assert(existsSync('recovery/evidence/inventory/inventory-wire.ts'));
assert(!existsSync('apps/shared/combat/role-profile-selection.ts'));
assert(existsSync('apps/server/src/accounts/profile/selection.ts'));
assert(existsSync('recovery/evidence/roles/role-profile-selection.ts'));
assert(!existsSync('apps/shared/combat/role-owned-sources.ts'));
assert(existsSync('apps/server/src/accounts/owned/receive-pair.ts'));
assert(existsSync('recovery/evidence/roles/role-owned-sources.ts'));
assert(!existsSync('apps/shared/combat/role-owned-equipment.ts'));
assert(existsSync('apps/shared/contracts/owned-equipment.ts'));
for (const [original, owner] of [
  ['role-recompute-sources', 'accounts/owned/source-selection'],
  ['role-battle-parts', 'battle/roles/part-definitions'],
  ['role-skill-sources', 'battle/roles/skill-sources'],
]) {
  assert(!existsSync(`apps/shared/combat/${original}.ts`));
  assert(existsSync(`apps/server/src/${owner}.ts`));
}
for (const suffix of ['-native.py', '.cts']) {
  const file = `role-recompute-sources${suffix}`;
  assert(!existsSync(`tests/${file}`));
  assert(existsSync(`recovery/evidence/roles/${file}`));
}
assert(existsSync('apps/shared/contracts/role-skills.ts'));
for (const [original, owner] of [
  ['role-attribute-state', 'attribute-state'],
  ['role-recompute', 'recompute'],
  ['role-recompute-base', 'recompute-base'],
  ['role-recompute-skill', 'recompute-skill'],
  ['role-recompute-limits', 'recompute-limits'],
  ['role-recompute-mastery', 'recompute-mastery'],
  ['role-recompute-readiness', 'recompute-readiness'],
  ['role-skills', 'skills'],
  ['role-data-scale', 'data-scale'],
  ['role-movement-setter', 'movement-setter'],
]) {
  assert(!existsSync(`apps/shared/combat/${original}.ts`));
  assert(existsSync(`apps/server/src/battle/roles/${owner}.ts`));
}
for (const name of ["combat-role-skills", "role-data-scale", "role-recompute-base", "role-recompute-limits", "role-recompute-mastery", "role-recompute-readiness", "role-recompute"]) {
  for (const suffix of ['-native.py', '.cts']) {
    assert(!existsSync(`tests/${name}${suffix}`));
    assert(existsSync(`recovery/evidence/attributes/${name}${suffix}`));
  }
}
for (const [original, owner] of [['role-state', 'combat-state'], ['role-record-defaults', 'record-defaults'], ['reload', 'reload'], ['role-free-fire', 'free-aim']]) {
  assert(!existsSync(`apps/shared/combat/${original}.ts`));
  assert(existsSync(`apps/server/src/battle/roles/${owner}.ts`));
}
for (const name of ['reload', 'role-free-fire', 'role-respawn-notification', 'role-skill-observer', 'role-ammo-observer', 'role-max-hp', 'role-ammo-change-wire']) {
  assert(!existsSync(`apps/shared/combat/${name}.ts`));
  assert(existsSync(`recovery/evidence/roles/${name}.ts`));
}
assert(!existsSync('apps/shared/combat/role-numeric-property.ts'));
assert(existsSync('recovery/evidence/roles/role-numeric-property.ts'));
assert(!existsSync('apps/shared/combat/role-texture-transfer-sol.ts'));
assert(existsSync('apps/shared/contracts/tank-textures.ts'));
assert(existsSync('apps/server/src/accounts/tank-texture-change.ts'));
assert(existsSync('recovery/evidence/tank-textures/role-texture-transfer-sol.ts'));
assert(existsSync('apps/shared/contracts/role-base.ts'));
assert(existsSync('apps/server/src/config/role-base.ts'));
for (const kind of ['tank', 'pet']) {
  assert(!existsSync(`apps/shared/combat/role-${kind}-base.ts`));
  for (const suffix of ['-native.py', '.cts']) {
    const file = `role-${kind}-base${suffix}`;
    assert(!existsSync(`tests/${file}`));
    assert(existsSync(`recovery/evidence/roles/${file}`));
  }
}
assert(!existsSync('apps/shared/combat/role-owned-definition.ts'));
assert(existsSync('apps/server/src/accounts/owned/definition.ts'));
for (const suffix of ['-native.py', '.cts']) {
  const file = `role-owned-definition${suffix}`;
  assert(!existsSync(`tests/${file}`));
  assert(existsSync(`recovery/evidence/roles/${file}`));
}
assert(!existsSync('apps/shared/combat/role-owned-base.ts'));
assert(existsSync('apps/shared/contracts/owned-base.ts'));
for (const suffix of ['.ts', '-native.py', '.cts']) {
  const file = `role-owned-base${suffix}`;
  assert(!existsSync(`tests/${file}`));
  assert(existsSync(`recovery/evidence/roles/${file}`));
}
for (const suffix of ['.ts', '-native.py', '.cts']) {
  const file = `role-owned-equipment${suffix}`;
  assert(!existsSync(`tests/${file}`));
  assert(existsSync(`recovery/evidence/roles/${file}`));
}
for (const name of ['pair', 'receive']) {
  for (const suffix of ['-native.py', '.cts']) {
    const file = `role-owned-${name}${suffix}`;
    assert(!existsSync(`tests/${file}`));
    assert(existsSync(`recovery/evidence/roles/${file}`));
  }
}
for (const name of ['tank', 'pet']) {
  assert(!existsSync(`apps/shared/combat/role-${name}-selection.ts`));
  assert(existsSync(`recovery/evidence/roles/role-${name}-selection.ts`));
  for (const suffix of ['-native.py', '.cts']) {
    const file = `role-${name}-selection${suffix}`;
    assert(!existsSync(`tests/${file}`));
    assert(existsSync(`recovery/evidence/roles/${file}`));
  }
}
assert(!existsSync('tests/role-selection-callback-native.py'));
assert(existsSync('recovery/evidence/roles/role-selection-callback-native.py'));
for (const name of ['confirmation', 'update', 'update-wire', 'equipment', 'cosmetics']) {
  assert(!existsSync(`apps/shared/combat/role-profile-${name}.ts`));
}
for (const name of ['payload', 'equipment', 'cosmetics']) {
  assert(existsSync(`apps/server/src/accounts/profile/${name}.ts`));
}
for (const name of ['request', 'unload', 'slot-count', 'error']) {
  assert(!existsSync(`apps/shared/combat/role-equipment-${name}.ts`));
  assert(existsSync(name === 'error'
    ? 'recovery/evidence/roles/role-equipment-error.ts'
    : `apps/server/src/accounts/equipment/${name}.ts`));
  for (const suffix of ['-native.py', '.cts']) {
    const file = `role-equipment-${name}${suffix}`;
    assert(!existsSync(`tests/${file}`));
    assert(existsSync(`recovery/evidence/roles/${file}`));
  }
}
for (const name of ['confirmation', 'update', 'update-wire', 'cosmetics']) {
  for (const suffix of ['-native.py', '.cts']) {
    const file = `role-profile-${name}${suffix}`;
    assert(!existsSync(`tests/${file}`));
    assert(existsSync(`recovery/evidence/roles/${file}`));
  }
  if (name !== 'cosmetics') assert(existsSync(`recovery/evidence/roles/role-profile-${name}.ts`));
}
for (const name of ['wire', 'packet', 'notifications']) {
  for (const suffix of ['-native.py', '.cts']) {
    const file = `inventory-${name}${suffix}`;
    assert(!existsSync(`tests/${file}`));
    assert(existsSync(`recovery/evidence/inventory/${file}`));
  }
}
assert(!existsSync('apps/shared/combat/kitbag-configuration.ts'));
assert(!existsSync('apps/shared/combat/kitbag-configuration-wire.ts'));
assert(!existsSync('apps/shared/combat/skill-effect-wire.ts'));
for (const file of ['skill-effect-wire.ts', 'skill-effect-wire.cts', 'skill-effect-message-native.py', 'skill-effect-queue-native.py']) {
  assert(existsSync(`recovery/evidence/skills/${file}`));
  assert(!existsSync(`tests/${file}`));
}
assert(existsSync('apps/server/src/accounts/kitbag-configuration.ts'));
assert(existsSync('apps/server/src/battle/items/kitbag-confirmation.ts'));
for (const file of ['kitbag-configuration-wire.ts', 'kitbag-configuration-native.py', 'kitbag-configuration.cts']) {
  assert(existsSync(`recovery/evidence/inventory/${file}`));
  assert(!existsSync(`tests/${file}`));
}
assert(!existsSync('apps/web/effect-model-render-check.html'));
assert(!existsSync('apps/web/src/effect-model-render-check.ts'));
assert(existsSync('tests/render/effect-model/index.html'));
assert(!existsSync('apps/web/effect-bolt-render-check.html'));
assert(!existsSync('apps/web/src/effect-bolt-render-check.ts'));
assert(existsSync('tests/render/effect-bolt/index.html'));
for (const name of ['effect', 'effect-particle', 'effect-overlay', 'skill-effect', 'effect-camera-shake']) {
  assert(!existsSync(`apps/web/${name}-render-check.html`));
  assert(!existsSync(`apps/web/src/${name}-render-check.ts`));
  assert(existsSync(`tests/render/${name}/index.html`));
}
assert(existsSync('recovery/evidence/tank-textures/role-texture-transfer-sol-native.py'));
assert(!existsSync('apps/shared/combat/home-preview-orbit.ts'));
assert(existsSync('apps/web/src/interface/home/home-preview-orbit.ts'));
assert(existsSync('recovery/evidence/home-preview/home-preview-orbit-native.py'));
assert(existsSync('recovery/evidence/home-preview/home-preview-projection-native.py'));
assert(!existsSync('tests/home-preview-orbit-native.py'));
assert(!existsSync('tests/home-preview-projection-native.py'));
assert(!existsSync('apps/web/src/assets/asset-viewer.ts'));
assert(existsSync('tools/asset-viewer/index.html'));
assert(!readFileSync(resolve('apps/web/index.html'), 'utf8').includes('id="viewer"'));

for (const view of ['battle-hud', 'portrait-state', 'battle-match', 'battle-chat']) {
  assert(!existsSync(`apps/web/src/${view}.ts`));
  assert(existsSync(`apps/web/src/interface/battle/${view}.ts`) || existsSync(`apps/web/src/interface/battle/${view}.tsx`));
}
assert(!existsSync('apps/web/src/source-ui-fonts.ts'));
assert(existsSync('apps/web/src/interface/resources/source-ui-fonts.ts'));

for (const [name, directory] of [
  ['scene-preview', 'assets/scenes'],
  ['scene-breach-state', 'assets/scenes'],
  ['tank-view', 'assets/tanks'],
  ['tank-textures', 'assets/tanks'],
  ['mv3-material', 'render/materials'],
]) {
  assert(!existsSync(`apps/web/src/${name}.ts`));
  assert(existsSync(`apps/web/src/${directory}/${name}.ts`));
}
for (const name of [
  'battle-skill-effects',
  'skill-effect-frame-scheduler',
  'skill-effect-notifications',
  'skill-effect-runtime',
]) {
  assert(!existsSync(`apps/web/src/${name}.ts`));
  assert(existsSync(`apps/web/src/match/skills/${name}.ts`));
}
for (const name of [
  'effect-model-renderer',
  'effect-model-mesh',
  'effect-model-node',
  'effect-model-draw',
  'effect-model-animation',
  'effect-model-material',
  'effect-material-combo-sol',
  'effect-attach-material-sol',
]) {
  assert(!existsSync(`apps/web/src/${name}.ts`));
  assert(existsSync(`apps/web/src/render/effects/models/${name}.ts`));
}
for (const name of ['battle-music', 'battle-sound', 'effect-skill-sound']) {
  assert(!existsSync(`apps/web/src/${name}.ts`));
  assert(existsSync(`apps/web/src/audio/${name}.ts`));
}
assert(existsSync('apps/web/src/audio/effect-sound.ts'));
for (const name of [
  'effect-particle-renderer',
  'effect-particle-node',
  'effect-particle-state',
  'effect-particle-pool',
  'effect-particle-spawn',
  'effect-emitter-clock',
]) {
  assert(!existsSync(`apps/web/src/${name}.ts`));
  assert(existsSync(`apps/web/src/render/effects/particles/${name}.ts`));
}
for (const name of [
  'effect-sprite-node',
  'effect-sprite-reset',
  'effect-sprite-space',
  'effect-sprite-atlas',
  'effect-trail',
]) {
  assert(!existsSync(`apps/web/src/${name}.ts`));
  assert(existsSync(`apps/web/src/render/effects/sprites/${name}.ts`));
}
for (const name of [
  'effect-strip-node',
  'effect-strip-state',
  'effect-strip-geometry',
  'effect-strip-uv',
]) {
  assert(!existsSync(`apps/web/src/${name}.ts`));
  assert(existsSync(`apps/web/src/render/effects/strips/${name}.ts`));
}
assert(existsSync('apps/web/src/render/effects/sprites/sprite-draw.ts'));
assert(existsSync('apps/web/src/render/effects/strips/strip-draw.ts'));
for (const name of [
  'effect-bolt-node',
  'effect-bolt-segments',
  'effect-bolt-draw',
]) {
  assert(!existsSync(`apps/web/src/${name}.ts`));
  assert(existsSync(`apps/web/src/render/effects/bolts/${name}.ts`));
}
for (const name of [
  'effect-overlay-node',
  'effect-overlay-draw',
  'effect-overlay-mesh',
]) {
  assert(!existsSync(`apps/web/src/${name}.ts`));
  assert(existsSync(`apps/web/src/render/effects/overlays/${name}.ts`));
}
for (const name of [
  'effect-billboard',
  'effect-camera',
  'effect-camera-shake',
  'effect-camera-shake-view',
]) {
  assert(!existsSync(`apps/web/src/${name}.ts`));
  assert(existsSync(`apps/web/src/render/effects/camera/${name}.ts`));
}
for (const name of [
  'effect-native-space', 'effect-render-transform', 'effect-color', 'effect-quad',
  'effect-frame-clock', 'effect-path-clock', 'effect-render-selection', 'effect-sprite-mesh',
]) {
  assert(!existsSync(`apps/web/src/${name}.ts`));
  assert(existsSync(`apps/web/src/render/effects/common/${name}.ts`));
}
assert(!existsSync('apps/web/src/effect-sprite-state.ts'));
assert(!existsSync('apps/web/src/effect-emitter-space.ts'));
for (const name of ['types', 'motion', 'delta', 'orbit']) {
  assert(existsSync(`apps/web/src/render/effects/common/${name}.ts`));
}
assert(existsSync('apps/web/src/render/effects/sprites/appearance.ts'));
assert(existsSync('apps/web/src/render/effects/particles/effect-emitter-space.ts'));
for (const file of visited) {
  if (!file.includes('/render/effects/common/')) continue;
  for (const [, reference] of readFileSync(file, 'utf8').matchAll(/from\s*['"]([^'"]+)['"]/g)) {
    if (!reference.startsWith('.')) continue;
    assert(!['sprites', 'strips', 'particles', 'models', 'bolts', 'overlays', 'camera'].some(family =>
      resolve(dirname(file), reference).includes(`/render/effects/${family}/`)),
      `Common effect rule imports family code: ${relative(workspace, file)} -> ${reference}`);
  }
}
for (const name of [
  'effect-runtime',
  'effect-runtime-tree',
  'effect-runtime-state-pool',
  'effect-object-pool',
  'effect-tree-create',
  'effect-world-start',
  'effect-lifecycle',
  'effect-timeline',
  'effect-target-provider',
  'effect-sound-node',
  'effect-screen-node',
]) {
  assert(!existsSync(`apps/web/src/${name}.ts`));
  assert(existsSync(`apps/web/src/render/effects/runtime/${name}.ts`));
}
for (const name of [
  'effect-action-events',
  'effect-actor-clock',
  'effect-tag-sampler',
  'effect-tag-world',
  'effect-tag-matrices',
  'effect-turret-pivot',
]) {
  assert(!existsSync(`apps/web/src/${name}.ts`));
  assert(existsSync(`apps/web/src/assets/tanks/${name}.ts`));
}
assert(!existsSync('apps/shared/combat/role-ammo-visual.ts'));
assert(existsSync('apps/web/src/assets/tanks/role-ammo-visual.ts'));
assert(!existsSync('apps/web/src/battle.ts'));
assert(!existsSync('apps/web/src/battle-targets.ts'));
assert(existsSync('apps/web/src/match/battle.ts'));
assert(existsSync('apps/web/src/match/battle-input.ts'));
assert(existsSync('apps/web/src/render/battle-targets.ts'));
console.log(`PASS ${visited.size} reachable runtime modules; no evidence or rendering validation dependency`);

const sharedCombat = ['catalog', 'cpu-loadout', 'inventory-query', 'item-hotkeys', 'role-owned-textures'];
assert.deepEqual(readdirSync('apps/shared/combat').filter(name => name.endsWith('.ts')).sort(), sharedCombat.map(name => `${name}.ts`).sort());
assert(existsSync('apps/server/src/battle/roles/property-dirty.ts'));
