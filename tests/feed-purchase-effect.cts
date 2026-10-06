import assert from 'node:assert/strict';
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {FreeCamera, NullEngine, RawTexture, Scene, TransformNode, Vector3, VertexBuffer} from '@babylonjs/core';
import {AccountStore} from '../apps/server/src/account-store';
import {applyHealingItem} from '../apps/server/src/battle/healing';
import {createRoleCombatState} from '../apps/server/src/battle/roles/combat-state';
import type {CombatCatalog} from '../apps/shared/combat/catalog';
import {initializeBattleQuantities, resolveItemHotkey} from '../apps/shared/combat/item-hotkeys';
import type {MsgRoomEvent} from '../apps/shared/protocols/MsgRoomEvent';
import type {ShopItem} from '../apps/shared/protocols/PtlShop';
import type {TankView} from '../apps/web/src/assets/tanks/tank-view';
import {BattleSkillEffects} from '../apps/web/src/match/skills/battle-skill-effects';
import {createSkillEffectNotifications} from '../apps/web/src/match/skills/skill-effect-runtime';
import {EFFECT_IDENTITY} from '../apps/web/src/render/effects/common/effect-render-transform';
import {EffectRuntime} from '../apps/web/src/render/effects/runtime/effect-runtime';
import type {EffectRuntimeLibrary, EffectRuntimeTree} from '../apps/web/src/render/effects/runtime/effect-runtime-tree';

const catalog = JSON.parse(readFileSync('recovery/output/web-assets/combat-catalog.json', 'utf8')) as CombatCatalog;
const source = JSON.parse(readFileSync('recovery/output/verified/tables/item.json', 'utf8')) as {
  rows: {values: Record<string, string>}[];
};
const row = source.rows.find(row => row.values.ItemTableID === '1')!.values;
const definition = catalog.items.find(item => item.itemTableId === 1)!;
assert.equal(definition.iconId, Number(row.D2));
assert.equal(definition.iconId, 1);
assert.equal(definition.skillIds[0], Number(row.ItemSkill1));
assert.equal(definition.skillIds[0], 1);
const shop: ShopItem[] = [{itemTableId: 1, name: definition.name, info: definition.info,
  iconId: definition.iconId!, moneyPrice: Number(row.ItemMoney), tokenPrice: Number(row.ItemCoin)}];
assert.deepEqual([shop[0].moneyPrice, shop[0].tokenPrice], [10, 10]);
assert.deepEqual([definition.moneyPrice, definition.tokenPrice], [shop[0].moneyPrice, shop[0].tokenPrice]);
const ui = JSON.parse(readFileSync('recovery/output/web-assets/ui.json', 'utf8')) as {
  imagesets: {path: string; attributes: {Name: string}; images: {Name: string; asset?: string}[]}[];
};
const iconReference = `data\\ui\\daoju\\${String(definition.iconId).padStart(5, '0')}.tga`;
const icon = ui.imagesets.find(set => set.attributes.Name === 'daoju0' && set.path.includes('imagesets_dds/'))!
  .images.find(image => image.Name === iconReference)!;
assert.equal(icon.asset, 'ui/regions/57/0.png');
assert.ok(readFileSync(`recovery/output/web-assets/${icon.asset}`).length > 0);

const directory = mkdtempSync(join(tmpdir(), 'cdtank-feed-effect-'));
const store = new AccountStore(join(directory, 'accounts.sqlite'));
const engine = new NullEngine();
const scene = new Scene(engine);
try {
  const account = store.open();
  assert.deepEqual(store.inventory(account.accountId).records, []);
  const profileEvidence = JSON.parse(readFileSync('recovery/output/role-profile-update-native.json', 'utf8')) as {
    updates: {code: number; before: number[]}[];
  };
  const profile = {bytes: new Uint8Array(profileEvidence.updates.find(row => row.code === 1)!.before),
    strings: ['饲料效果测试', ''] as [string, string]};
  const profileView = new DataView(profile.bytes.buffer);
  profileView.setUint32(0x70, 100, true);
  profileView.setUint32(0x74, 100, true);
  store.replaceRoleProfile(account.accountId, profile);
  const first = store.shop(account.accountId, shop, {operation: 'BUY', itemTableId: 1,
    quantity: 1, currency: 'MONEY', requestId: 'feed-effect-first'}).purchased!;
  const receipt = store.shop(account.accountId, shop, {operation: 'BUY', itemTableId: 1,
    quantity: 2, currency: 'TOKENS', requestId: 'feed-effect-second'});
  const purchased = receipt.purchased!;
  assert.notEqual(purchased.instanceId, first.instanceId);
  assert.notEqual(purchased.instanceId, purchased.itemTableId, 'allocated identity must not select definition');
  assert.deepEqual([receipt.money, receipt.tokens], [90, 80]);
  store.assign(account.accountId, purchased.instanceId, 4);
  const inventory = store.inventory(account.accountId);
  initializeBattleQuantities(inventory.hotkeys, inventory.records, id => catalog.items.find(item => item.itemTableId === id)!.battleUseMax);
  const request = resolveItemHotkey(5, true, inventory.hotkeys, inventory.records);
  assert.deepEqual(request, {accepted: true, command: {kind: 'useItem', instanceId: purchased.instanceId}});
  const combat = createRoleCombatState();
  combat.setStatus(2);
  const player = {id: 'P47', name: '饲料效果测试', alive: true, hp: 50, x: 0, y: 0, z: 0,
    combat, inventory: inventory.records, attributes: {record: {hp: 50, maxHp: 300}}};
  const events: MsgRoomEvent[] = [];
  const command = request.command;
  assert.equal(command.kind, 'useItem');
  if (command.kind !== 'useItem') throw new Error('首件购买应产生普通道具请求');
  applyHealingItem('R1', player, command, () => 300,
    (_id, instance, owned, table) => store.consumeItem(account.accountId, instance, owned, table), events);
  assert.equal(player.hp, 250);
  assert.equal(store.inventory(account.accountId).records.find(item => item.instanceId === purchased.instanceId)!.ownedQuantity, 1);
  assert.equal(store.inventory(account.accountId).records.find(item => item.instanceId === first.instanceId)!.ownedQuantity, 1);
  assert.equal(events.length, 1);
  assert.deepEqual(events[0].playSkillEffect, {skillId: 1, effectIndex: 0, duration: 0, roleId: 47, xBits: 0, zBits: 0});
  assert.deepEqual(catalog.skills.find(skill => skill.skillId === 1)!.effects[0], {effectId: 11, sound: 'GA15', tag: 0, method: 3});

  const camera = new FreeCamera('camera', new Vector3(0, 0, -100), scene);
  camera.setTarget(Vector3.Zero()); camera.getViewMatrix(true); camera.getProjectionMatrix(true);
  const runtime = new EffectRuntime(scene, camera);
  const loaded = runtime as unknown as {library: EffectRuntimeLibrary; textures: Map<string, RawTexture>;
    instances: {handle: number; tree: EffectRuntimeTree; draws: unknown[]}[]};
  loaded.library = JSON.parse(readFileSync('recovery/output/web-assets/effect-library.json', 'utf8'));
  const drawnNodes = [2664, 2665, 2667, 2830, 2834];
  for (const asset of new Set(loaded.library.textureGrids.filter(grid => drawnNodes.includes(grid.node)).map(grid => grid.asset))) {
    loaded.textures.set(asset, RawTexture.CreateRGBATexture(new Uint8Array([255, 255, 255, 255]), 1, 1, scene));
  }
  const parent = [...EFFECT_IDENTITY];
  const root = new TransformNode('actor', scene);
  const actor = {root, primaryTag: (tag: string) => tag === 'tag_efcenter' ? parent : undefined} as unknown as TankView;
  const sounds: {reference: string; selector: number}[] = [];
  const originalSound = runtime.playSkillSound.bind(runtime);
  runtime.playSkillSound = (role, reference, selector) => {sounds.push({reference, selector}); return originalSound(role, reference, selector);};
  const notifications = createSkillEffectNotifications(runtime, catalog, {role: id => id === 47 ? actor : undefined, localRole: () => actor});
  const battle = new BattleSkillEffects(notifications);
  runtime.start();
  const play = (): void => battle.event(events[0]);
  play(); runtime.update(.05);
  const instance = loaded.instances[0];
  assert.ok(instance.handle > 0);
  assert.equal(instance.draws.length, 5);
  assert.equal(instance.tree.parentMatrix, parent);
  const native = JSON.parse(readFileSync('recovery/output/effect-tree-create-native.json', 'utf8')) as {
    rows: {node: number; retain: boolean; created: {node: number; retain: boolean}[]}[];
  };
  assert.deepEqual(instance.tree.nodes.map(node => ({node: node.definition.index, retain: node.lifecycle.retainWhenEnded})),
    native.rows.find(row => row.node === 2637 && !row.retain)!.created);
  assert.equal(notifications.records.length, 0);
  assert.equal(notifications.queues.size, 0);
  battle.stop({skillId: 1, roleId: 47});
  battle.revive('P47');
  assert.equal(loaded.instances[0], instance);
  assert.deepEqual(sounds, [{reference: 'GA15', selector: 1}]);
  const ring = scene.meshes.find(mesh => mesh.metadata?.sourceNode === 2664)!;
  const before = [...ring.getVerticesData(VertexBuffer.PositionKind)!];
  parent[12] = 20; runtime.update(0);
  const after = ring.getVerticesData(VertexBuffer.PositionKind)!;
  for (let index = 0; index < 18; index += 3) assert.ok(Math.abs(after[index] - before[index] + 20) < .00001);
  const rendered = new Set<number>();
  for (let tick = 0; tick < 200 && loaded.instances.length; tick++) {
    runtime.update(.025);
    for (const mesh of scene.meshes) if (mesh.isEnabled() && mesh.getTotalVertices() > 0) rendered.add(mesh.metadata.sourceNode);
  }
  assert.deepEqual([...rendered].sort((a, b) => a - b), drawnNodes);
  const empty = (): void => {assert.equal(loaded.instances.length, 0); assert.equal(scene.meshes.length, 0); assert.equal(scene.materials.length, 0);};
  empty();
  play(); runtime.update(.05); runtime.stopEffect(loaded.instances[0].handle); empty();
  play(); runtime.update(.05); runtime.detach(actor); empty();
  play(); runtime.update(.05); runtime.stop(); empty();
  assert.deepEqual(sounds, Array.from({length: 4}, () => ({reference: 'GA15', selector: 1})));
  writeFileSync('recovery/output/feed-purchase-effect.json', `${JSON.stringify({status: 'PASS',
    initialInventoryEmpty: true, firstInstance: first.instanceId, purchasedInstance: purchased.instanceId,
    itemTableId: purchased.itemTableId, balances: {money: receipt.money, tokens: receipt.tokens},
    skillId: 1, effectId: 11, tag: 'tag_efcenter', sound: 'GA15', iconD2: definition.iconId,
    iconReference, iconAsset: icon.asset, ordinaryDigit5Request: command, healing: {before: 50, after: player.hp},
    renderedNodes: [...rendered].sort((a, b) => a - b), liveAttachment: true,
    naturalExpiry: true, stopNotificationPreservesOneShot: true, revivalDoesNotReplay: true,
    explicitHandleStop: true, detach: true, runtimeStop: true,
    scope: 'Real SQLite paid acquisition, assignment, ordinary hotkey resolver, healing CAS and production effect notification/runtime. NullEngine with fixture texture pixels; physical audio and actual browser pixels require browser acceptance.'}, null, 2)}\n`);
  console.log('PASS: empty inventory paid purchase, distinct instance2 -> item1/iconD2=1/skill1/Effect11/Tag0/GA15, ordinary Digit5 healing CAS and runtime lifecycle');
} finally {scene.dispose(); engine.dispose(); store.close(); rmSync(directory, {recursive: true, force: true});}
