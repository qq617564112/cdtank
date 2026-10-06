import assert from 'node:assert/strict';
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {FreeCamera, NullEngine, RawTexture, Scene, TransformNode, Vector3, VertexBuffer} from '@babylonjs/core';
import {AccountStore} from '../apps/server/src/account-store';
import {consumableShopItems} from '../apps/server/src/accounts/shop-catalog';
import {applyHealingItem} from '../apps/server/src/battle/healing';
import {applyAttackDrink} from '../apps/server/src/battle/items/attack-drink';
import {applySpeedDrink} from '../apps/server/src/battle/items/speed-drink';
import {applyTurnDrink} from '../apps/server/src/battle/items/turn-drink';
import {applyInvincibility} from '../apps/server/src/battle/items/invincibility';
import {createRoleCombatState} from '../apps/server/src/battle/roles/combat-state';
import type {CombatCatalog} from '../apps/shared/combat/catalog';
import {initializeBattleQuantities, resolveItemHotkey} from '../apps/shared/combat/item-hotkeys';
import type {MsgRoomEvent} from '../apps/shared/protocols/MsgRoomEvent';
import type {TankView} from '../apps/web/src/assets/tanks/tank-view';
import {BattleSkillEffects} from '../apps/web/src/match/skills/battle-skill-effects';
import {createSkillEffectNotifications} from '../apps/web/src/match/skills/skill-effect-runtime';
import {EFFECT_IDENTITY} from '../apps/web/src/render/effects/common/effect-render-transform';
import {EffectRuntime} from '../apps/web/src/render/effects/runtime/effect-runtime';
import type {EffectRuntimeLibrary, EffectRuntimeTree} from '../apps/web/src/render/effects/runtime/effect-runtime-tree';

const read = <T,>(path: string): T => JSON.parse(readFileSync(path, 'utf8')) as T;
const catalog = read('recovery/output/web-assets/combat-catalog.json') as CombatCatalog;
const library = read('recovery/output/web-assets/effect-library.json') as EffectRuntimeLibrary;
const sourceItems = read<{rows: {values: Record<string, string>}[]}>('recovery/output/verified/tables/item.json').rows;
const sourceSkills = read<{rows: {values: Record<string, string>}[]}>('recovery/output/verified/tables/skill.json').rows;
const native = read('recovery/output/effect-tree-create-native.json') as {
  rows: {node: number; retain: boolean; created: {node: number; retain: boolean}[]}[];
};
const ui = read('recovery/output/web-assets/ui.json') as {
  imagesets: {path: string; attributes: {Name: string}; images: {Name: string; asset: string}[]}[];
};
const audio = read('recovery/output/web-assets/audio.json') as {sounds: {name: string; asset: string}[]};
const shop = consumableShopItems(catalog);
const expected = [
  {item: 1, effect: 11, sound: 'GA15', root: 2637, draws: [2664, 2665, 2667, 2830, 2834]},
  {item: 2, effect: 11, sound: 'GA15', root: 2637, draws: [2664, 2665, 2667, 2830, 2834]},
  {item: 4, effect: 106, sound: 'SE38', root: 2907, draws: [2908, 2909, 2910, 2912, 2913, 2914, 3103]},
  {item: 6, effect: 110, sound: 'SE42', root: 2927, draws: [2928, 2929, 2930, 2932, 2933, 2934, 3108]},
  {item: 7, effect: 113, sound: 'SE45', root: 3010, draws: [3012, 3013, 3014, 3016, 3017, 3018, 3111]},
  {item: 8, effect: 100, sound: '0', root: 2992, draws: [2993, 2994, 2995, 2996]},
];
assert.deepEqual(shop.map(item => item.itemTableId), [1, 2, 3, 4, 5, 6, 7, 8, 2007, 2011]);
assert(expected.every(row => shop.some(item => item.itemTableId === row.item)));
const directory = mkdtempSync(join(tmpdir(), 'cdtank-consumables-effect-'));
const store = new AccountStore(join(directory, 'accounts.sqlite'));
const evidence: unknown[] = [];
try {
  const account = store.open();
  assert.deepEqual(store.inventory(account.accountId).records, []);
  const profileEvidence = read<{updates: {code: number; before: number[]}[]}>('recovery/output/role-profile-update-native.json');
  const profile = {bytes: new Uint8Array(profileEvidence.updates.find((row: {code: number}) => row.code === 1)!.before),
    strings: ['消耗品效果测试', ''] as [string, string]};
  const profileView = new DataView(profile.bytes.buffer);
  profileView.setUint32(0x70, 1000, true);
  profileView.setUint32(0x74, 1000, true);
  store.replaceRoleProfile(account.accountId, profile);
  let expectedMoney = 1000, expectedTokens = 1000;
  for (const binding of expected) {
    const row = sourceItems.find(row => Number(row.values.ItemTableID) === binding.item)!.values;
    const definition = catalog.items.find(item => item.itemTableId === binding.item)!;
    assert.deepEqual([definition.name, definition.info, definition.iconId, definition.moneyPrice, definition.tokenPrice],
      [row.ItemName, row.ItemInfo, Number(row.D2), Number(row.ItemMoney), Number(row.ItemCoin)]);
    assert.equal(definition.battleUseMax, Number(row.BattleUseMax));
    assert.deepEqual(definition.skillIds, [1, 2, 3].map(slot => Number(row[`ItemSkill${slot}`])));
    const effects = (values: Record<string, string>) => [1, 2, 3].map(slot => ({
      effectId: Number(values[`Effect${slot}`]), sound: values[`Sound${slot}`],
      tag: Number(values[`EffectTag${slot}`]), method: Number(values[`EffectMethod${slot}`]),
    }));
    assert.deepEqual(definition.effects, effects(row));
    const skill = catalog.skills.find(skill => skill.skillId === definition.skillIds[0])!;
    const sourceSkill = sourceSkills.find(row => Number(row.values.SkillTableID) === skill.skillId)!.values;
    assert.deepEqual(skill.effects, effects(sourceSkill));
    assert.deepEqual(skill.effects[0], {effectId: binding.effect, sound: binding.sound, tag: 0, method: 3});
    const iconReference = `data\\ui\\daoju\\${String(definition.iconId).padStart(5, '0')}.tga`;
    const icon = ui.imagesets.find(set => set.attributes.Name === 'daoju0' && set.path.includes('imagesets_dds/'))!
      .images.find(image => image.Name === iconReference)!;
    assert.ok(readFileSync(`recovery/output/web-assets/${icon.asset}`).length > 0);
    const first = store.shop(account.accountId, shop, {operation: 'BUY', itemTableId: binding.item,
      quantity: 1, currency: 'MONEY', requestId: `effect-${binding.item}-money`}).purchased!;
    const receipt = store.shop(account.accountId, shop, {operation: 'BUY', itemTableId: binding.item,
      quantity: 1, currency: 'TOKENS', requestId: `effect-${binding.item}-tokens`});
    expectedMoney -= Number(row.ItemMoney);
    expectedTokens -= Number(row.ItemCoin);
    assert.deepEqual([receipt.money, receipt.tokens], [expectedMoney, expectedTokens]);
    const purchased = receipt.purchased!;
    assert.notEqual(purchased.instanceId, first.instanceId);
    assert.notEqual(purchased.instanceId, binding.item);
    assert.equal(purchased.itemTableId, binding.item);
    store.assign(account.accountId, purchased.instanceId, 4);
    const inventory = store.inventory(account.accountId);
    initializeBattleQuantities(inventory.hotkeys, inventory.records,
      id => catalog.items.find(item => item.itemTableId === id)!.battleUseMax);
    const request = resolveItemHotkey(5, true, inventory.hotkeys, inventory.records);
    assert.deepEqual(request, {accepted: true, command: {kind: 'useItem', instanceId: purchased.instanceId}});
    const command = request.command;
    if (command.kind !== 'useItem') throw new Error('Digit5 must produce an instance request');
    const combat = createRoleCombatState();
    combat.setStatus(2);
    const player = {id: 'P47', name: '消耗品效果测试', alive: true, hp: 50, x: 0, y: 0, z: 0,
      combat, inventory: inventory.records, attributesReady: true, attributes: {record: {hp: 50, maxHp: 1000}}};
    const events: MsgRoomEvent[] = [];
    const consume = (_id: string, instance: number, owned: number, table: number): boolean =>
      store.consumeItem(account.accountId, instance, owned, table);
    if (binding.item <= 2) applyHealingItem('R1', player, command, () => 1000, consume, events);
    else {
      const apply = binding.item === 4 ? applyAttackDrink : binding.item === 6 ? applySpeedDrink
        : binding.item === 7 ? applyTurnDrink : applyInvincibility;
      apply('R1', player, command, 1000, () => {}, consume, events);
    }
    assert.equal(events.length, 1);
    assert.equal(events[0].type, 'itemUsed');
    assert.deepEqual(events[0].playSkillEffect, {skillId: skill.skillId, effectIndex: 0,
      duration: binding.item === 8 ? 10 : 0, roleId: 47, xBits: 0, zBits: 0});
    assert.equal(store.inventory(account.accountId).records.find(item => item.instanceId === purchased.instanceId)!.ownedQuantity, 0);
    assert.equal(store.inventory(account.accountId).records.find(item => item.instanceId === first.instanceId)!.ownedQuantity, 1);
    const engine = new NullEngine();
    const scene = new Scene(engine);
    try {
      const camera = new FreeCamera('camera', new Vector3(0, 0, -100), scene);
      camera.setTarget(Vector3.Zero()); camera.getViewMatrix(true); camera.getProjectionMatrix(true);
      const runtime = new EffectRuntime(scene, camera);
      const loaded = runtime as unknown as {library: EffectRuntimeLibrary; textures: Map<string, RawTexture>;
        instances: {handle: number; tree: EffectRuntimeTree; draws: unknown[]}[]};
      loaded.library = library;
      const grids = library.textureGrids.filter(grid => binding.draws.includes(grid.node));
      assert.equal(grids.length, binding.draws.length);
      assert.ok(grids.every(grid => grid.resolution === 'published'));
      for (const asset of new Set(grids.map(grid => grid.asset))) {
        assert.ok(readFileSync(`recovery/output/web-assets/${asset}`).length > 0);
        loaded.textures.set(asset, RawTexture.CreateRGBATexture(new Uint8Array([255, 255, 255, 255]), 1, 1, scene));
      }
      const parent = [...EFFECT_IDENTITY];
      const actor = {root: new TransformNode('actor', scene),
        primaryTag: (tag: string) => tag === 'tag_efcenter' ? parent : undefined} as unknown as TankView;
      const sounds: {reference: string; selector: number}[] = [];
      const playSound = runtime.playSkillSound.bind(runtime);
      runtime.playSkillSound = (actor, reference, selector) => {
        sounds.push({reference, selector}); return playSound(actor, reference, selector);
      };
      const notifications = createSkillEffectNotifications(runtime, catalog,
        {role: id => id === 47 ? actor : undefined, localRole: () => actor});
      const battle = new BattleSkillEffects(notifications);
      runtime.start(); battle.event(events[0]); runtime.update(binding.item === 8 ? .25 : .05);
      const instance = loaded.instances[0];
      assert.ok(instance.handle > 0);
      assert.equal(instance.tree.parentMatrix, parent);
      assert.equal(instance.draws.length, binding.draws.length);
      assert.deepEqual(instance.tree.nodes.map(node => ({node: node.definition.index, retain: node.lifecycle.retainWhenEnded})),
        native.rows.find(row => row.node === binding.root && !row.retain)!.created);
      assert.deepEqual(sounds, [{reference: binding.sound, selector: binding.item === 8 ? -1 : 1}]);
      const soundAsset = audio.sounds.find(sound => sound.name === binding.sound)?.asset;
      if (binding.sound === '0') assert.equal(soundAsset, undefined);
      else assert.ok(readFileSync(`recovery/output/web-assets/${soundAsset}`).length > 0);
      const mesh = scene.meshes.find(mesh => mesh.metadata?.sourceNode === binding.draws[0])!;
      assert.ok(mesh);
      const before = [...mesh.getVerticesData(VertexBuffer.PositionKind)!];
      parent[12] = 20; runtime.update(0);
      const after = mesh.getVerticesData(VertexBuffer.PositionKind)!;
      for (let index = 0; index < Math.min(18, after.length); index += 3) assert.ok(Math.abs(after[index] - before[index] + 20) < .0001);
      const rendered = new Set<number>();
      const collect = (): void => {
        for (const mesh of scene.meshes) if (mesh.isEnabled() && mesh.getTotalVertices() > 0) rendered.add(mesh.metadata.sourceNode);
      };
      collect();
      if (binding.item === 8) {
        assert.equal(notifications.records.length, 1);
        for (let step = 0; step < 10; step++) {runtime.update(.025); notifications.update(30); collect();}
      } else {
        assert.equal(notifications.records.length, 0);
        for (let tick = 0; tick < 200 && loaded.instances.length; tick++) {runtime.update(.025); collect();}
      }
      assert.deepEqual([...rendered].sort((a, b) => a - b), binding.draws);
      assert.equal(loaded.instances.length, 0);
      assert.equal(scene.meshes.length, 0);
      assert.equal(scene.materials.length, 0);
      runtime.stop();
      evidence.push({itemTableId: binding.item, firstInstance: first.instanceId, purchasedInstance: purchased.instanceId,
        balances: {money: receipt.money, tokens: receipt.tokens}, iconD2: definition.iconId, iconReference,
        iconAsset: icon.asset, ordinaryDigit5Request: command, skillId: skill.skillId, skillEffects: skill.effects,
        selectedEffect: skill.effects[0], soundAsset: soundAsset ?? null, nativeRoot: binding.root,
        renderedNodes: [...rendered].sort((a, b) => a - b), liveAttachment: true, resourcesReleased: true});
    } finally {scene.dispose(); engine.dispose();}
  }
  writeFileSync('recovery/output/consumables-purchase-effect.json', `${JSON.stringify({status: 'PASS',
    initialInventoryEmpty: true, initialBalances: {money: 1000, tokens: 1000}, rows: evidence,
    limitations: ['NullEngine uses fixture texture pixels; actual browser pixels and audible playback need browser evidence.',
      'Original drink second-slot trigger and original server item success/function dispatch remain unresolved.',
      'Embedded ww051 has no recovered asset; existing native missing-descriptor evidence remains unchanged.']}, null, 2)}\n`);
  console.log('PASS: six paid consumables retain source icons/skills/effect slots/sounds through distinct-instance Digit5 use and native runtime trees/geometry/attachment/cleanup');
} finally {store.close(); rmSync(directory, {recursive: true, force: true});}
