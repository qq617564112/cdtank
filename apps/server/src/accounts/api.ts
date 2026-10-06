import {registerStackItemSaleApi} from './stack-item-sale-api';
import {registerPartSaleApi} from './part-sale-api';
import {registerPartMaintenanceApi} from './part-maintenance-api';
import {readFileSync} from 'node:fs';
import type {WsServer} from 'tsrpc';
import type {CombatCatalog} from '../../../shared/combat/catalog';
import type {ServiceType} from '../../../shared/protocols/serviceProto';
import type {AccountStore} from '../account-store';
import type {TankConfig} from '../config';
import type {World} from '../world';
import {webAssetPath} from '../runtime/content-paths';
import {registerTankTextureApi} from './tank-textures';
import {registerShopApi} from './shop-api';
import {registerTankShopApi} from './tank-shop-api';
import {registerTankMaintenanceApi} from './tank-maintenance-api';
import {registerPetSkillLearningApi} from './pet-skill-learning-api';
import {registerOwnedRoleSaleApi} from './owned-role-sale-api';
import {registerPetShopApi} from './pet-shop-api';
import {readRoleProfilePlayerSummary} from './profile/player-summary';

interface AccountSession {
  roomId: string;
  playerId: string;
}

export function registerAccountApis(
  server: WsServer<ServiceType>,
  accounts: AccountStore,
  world: World,
  accountByConnection: Map<string, string>,
  sessionByConnection: ReadonlyMap<string, AccountSession>,
  broadcastRoomState: (roomId: string) => void,
  ownedTank: (accountId: string, instanceId: number) => TankConfig,
  restoreRoom: (accountId: string, connectionId: string) => void,
): void {
  const combatCatalog = JSON.parse(readFileSync(webAssetPath('combat-catalog.json'), 'utf8')) as CombatCatalog;

  registerShopApi(server, accounts, world, combatCatalog, accountByConnection, sessionByConnection, broadcastRoomState);
  registerTankShopApi(server, accounts, world, accountByConnection, sessionByConnection, broadcastRoomState);
  registerStackItemSaleApi(server, accounts, world, combatCatalog, accountByConnection, sessionByConnection, broadcastRoomState);
  registerPartSaleApi(server, accounts, world, combatCatalog, accountByConnection, sessionByConnection, broadcastRoomState);
  registerPartMaintenanceApi(server, accounts, world, combatCatalog, accountByConnection, sessionByConnection, broadcastRoomState);
  registerTankMaintenanceApi(server, accounts, world, combatCatalog, accountByConnection, sessionByConnection, broadcastRoomState);
  registerPetSkillLearningApi(server, accounts, world, combatCatalog, accountByConnection, sessionByConnection, broadcastRoomState);
  registerOwnedRoleSaleApi(server, accounts, world, combatCatalog, accountByConnection, sessionByConnection);
  registerPetShopApi(server, accounts, world, accountByConnection, sessionByConnection);

  server.implementApi('History', async call => {
    const accountId = accountByConnection.get(call.conn.id);
    if (!accountId) return call.error('请先登录账户', {code: 'ACCOUNT_REQUIRED'});
    try {
      await call.succ(accounts.history(accountId, call.req.offset, call.req.limit));
    } catch (error) {
      await call.error(error instanceof Error ? error.message : '对局记录查询失败', {code: 'HISTORY_REJECTED'});
    }
  });

  server.implementApi('Account', async call => {
    if (sessionByConnection.has(call.conn.id)) return call.error('请离开房间后登录账户', {code: 'ACCOUNT_IN_ROOM'});
    try {
      const session = accounts.authenticate(call.req);
      restoreRoom(session.accountId, call.conn.id);
      accountByConnection.set(call.conn.id, session.accountId);
      await call.succ(session);
    } catch (error) {
      await call.error(error instanceof Error ? error.message : '账户登录失败', {code: 'ACCOUNT_REJECTED'});
    }
  });

  server.implementApi('Channel', async call => {
    if (!accountByConnection.has(call.conn.id)) return call.error('请先登录账户', {code: 'ACCOUNT_REQUIRED'});
    if (call.req.operation === 'ENTER' && call.req.channelId !== 'main') {
      return call.error('频道不存在', {code: 'CHANNEL_NOT_FOUND'});
    }
    await call.succ({channels: [{id: 'main', name: '当前服务器', region: '当前服务器', levelLabel: '不限等级', available: true}],
      enteredChannelId: call.req.operation === 'ENTER' ? 'main' : undefined});
  });

  server.implementApi('Inventory', async call => {
    const accountId = accountByConnection.get(call.conn.id);
    if (!accountId) return call.error('请先登录账户', {code: 'ACCOUNT_REQUIRED'});
    const session = sessionByConnection.get(call.conn.id);
    await call.succ(session ? world.inventory(session.playerId) : accounts.inventory(accountId));
  });

  server.implementApi('OwnedRoles', async call => {
    const accountId = accountByConnection.get(call.conn.id);
    if (!accountId) return call.error('请先登录账户', {code: 'ACCOUNT_REQUIRED'});
    const owned = accounts.roleRecords(accountId);
    await call.succ({
      base: [...owned.base.values()].map(record => ({name: record.name, fields: [...record.fields]})),
      equipment: [...owned.equipment.values()].map(record => ({name: record.name, fields: [...record.fields]})),
    });
  });

  server.implementApi('RoleProfile', async call => {
    const accountId = accountByConnection.get(call.conn.id);
    if (!accountId) return call.error('请先登录账户', {code: 'ACCOUNT_REQUIRED'});
    const profile = accounts.roleProfile(accountId);
    await call.succ(profile ? {profile: {bytes: [...profile.bytes], strings: profile.strings},
      playerSummary: readRoleProfilePlayerSummary(profile)} : {});
  });

  server.implementApi('SelectRole', async call => {
    const accountId = accountByConnection.get(call.conn.id);
    if (!accountId) return call.error('请先登录账户', {code: 'ACCOUNT_REQUIRED'});
    const session = sessionByConnection.get(call.conn.id);
    if (session && !world.canConfigureInventory(session.playerId)) {
      return call.error('对局进行中不能更换角色', {code: 'ROLE_SELECTION_REJECTED'});
    }
    try {
      const tank = session && call.req.kind === 'tank'
        ? ownedTank(accountId, call.req.instanceId) : undefined;
      const profile = accounts.selectRole(accountId, call.req.kind, call.req.instanceId);
      if (session && tank) {
        world.selectTank(session.playerId, tank);
      }
      if (session) {
        world.bindRoleSources(session.playerId, accounts.selectedRoleSources(accountId));
        world.bindEquipmentProfile(session.playerId, profile);
        broadcastRoomState(session.roomId);
      }
      await call.succ({code: call.req.kind === 'pet' ? 0 : 1,
        profile: {bytes: [...profile.bytes], strings: profile.strings}});
    } catch (error) {
      await call.error(error instanceof Error ? error.message : '角色选择失败', {code: 'ROLE_SELECTION_REJECTED'});
    }
  });

  registerTankTextureApi(server, accounts, world, accountByConnection, sessionByConnection, broadcastRoomState);

  server.implementApi('Equipment', async call => {
    const accountId = accountByConnection.get(call.conn.id);
    if (!accountId) return call.error('请先登录账户', {code: 'ACCOUNT_REQUIRED'});
    const session = sessionByConnection.get(call.conn.id);
    if (call.req.operation !== 'QUERY' && session && !world.canConfigureInventory(session.playerId)) {
      return call.error('请在准备阶段配置装备', {code: 'EQUIPMENT_REJECTED'});
    }
    try {
      const result = call.req.operation === 'QUERY' ? accounts.equipment(accountId, combatCatalog)
        : call.req.target === 'DECORATION' || call.req.target === 'MARK'
          ? accounts.configureCosmetic(accountId, combatCatalog, call.req.operation, call.req.target, call.req.instanceId)
          : accounts.configureEquipment(accountId, combatCatalog, call.req.operation, call.req.slot!, call.req.instanceId);
      if (session && call.req.operation !== 'QUERY') {
        world.bindInventory(session.playerId, accounts.inventory(accountId));
        world.bindEquipmentProfile(session.playerId, result.profile);
        broadcastRoomState(session.roomId);
      }
      await call.succ({slots: result.slots, slotCount: result.slotCount,
        decorationInstanceId: result.decorationInstanceId, markInstanceId: result.markInstanceId,
        profile: {bytes: [...result.profile.bytes], strings: result.profile.strings}});
    } catch (error) {
      await call.error(error instanceof Error ? error.message : '部件配置失败', {code: 'EQUIPMENT_REJECTED'});
    }
  });

  server.implementApi('Kitbag', async call => {
    const accountId = accountByConnection.get(call.conn.id);
    if (!accountId) return call.error('请先登录账户', {code: 'ACCOUNT_REQUIRED'});
    const session = sessionByConnection.get(call.conn.id);
    if (session && !world.canConfigureInventory(session.playerId)) {
      return call.error('请在准备阶段配置快捷槽', {code: 'KITBAG_IN_BATTLE'});
    }
    try {
      const result = call.req.operation === 'ASSIGN'
        ? accounts.assign(accountId, call.req.instanceId ?? 0, call.req.slot)
        : accounts.cancel(accountId, call.req.slot);
      if (session) world.confirmKitbag(session.playerId, result);
      await call.succ({...result, instanceId: call.req.operation === 'ASSIGN' ? call.req.instanceId! : 0,
        hotkeys: accounts.inventory(accountId).hotkeys});
    } catch (error) {
      await call.error(error instanceof Error ? error.message : '快捷槽配置失败', {code: 'KITBAG_REJECTED'});
    }
  });
}
