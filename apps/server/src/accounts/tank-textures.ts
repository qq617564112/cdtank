import {content} from '../content';
import type {WsServer} from 'tsrpc';
import type {ServiceType} from '../../../shared/protocols/serviceProto';
import type {AccountStore} from '../account-store';
import type {World} from '../world';

interface TankTextureSession {
  roomId: string;
  playerId: string;
}

interface TankTextureCatalogRow {
  recordId: number;
  tankId: number;
  part: 'U' | 'M' | 'XY';
  rarity: number;
  selectable: boolean;
  moneyPrice: number;
  tokenPrice: number;
  textures: {A: {asset: string | null; status: string}; B: {asset: string | null; status: string} | null};
}

export function registerTankTextureApi(
  server: WsServer<ServiceType>,
  accounts: AccountStore,
  world: World,
  accountByConnection: ReadonlyMap<string, string>,
  sessionByConnection: ReadonlyMap<string, TankTextureSession>,
  broadcastRoomState: (roomId: string) => void,
): void {
  const textureCatalog = {rows: [...content.tanks.values()].flatMap(tank => tank.resources.textureVariants)};
  const textureTanks = [...content.tanks.values()].map(tank => ({id: tank.id, components: tank.resources.components}));
  // A source row is purchasable here only when every texture used by that actor exists.
  const availableTankTextures = textureCatalog.rows.filter(row => {
    const parts = textureTanks.find(tank => tank.id === row.tankId)?.components
      .filter(component => component.actions.length > 0).map(component => component.part) ?? [];
    const hasComponent = row.part === 'XY' ? parts.includes('X') || parts.includes('Y') : parts.includes(row.part);
    const variants = row.part === 'XY' ? [row.textures.A, row.textures.B] : [row.textures.A];
    return row.selectable && hasComponent && variants.every(asset => asset?.status === 'resolved' && asset.asset)
      && [row.moneyPrice, row.tokenPrice].every(price => Number.isInteger(price) && price >= 0 && price <= 0xffffffff);
  });

  server.implementApi('TankTextures', async call => {
    const accountId = accountByConnection.get(call.conn.id);
    if (!accountId) return call.error('请先登录账户', {code: 'ACCOUNT_REQUIRED'});
    const session = sessionByConnection.get(call.conn.id);
    if (session && !world.canConfigureInventory(session.playerId)) {
      return call.error('请在准备阶段更换战车迷彩', {code: 'TANK_TEXTURES_REJECTED'});
    }
    try {
      const confirmation = accounts.configureTankTextures(accountId, call.req.instanceId,
        call.req.textures, availableTankTextures);
      const profile = accounts.roleProfile(accountId)!;
      const owned = accounts.roleRecords(accountId);
      if (session && confirmation.result === 3) {
        world.bindRoleSources(session.playerId, accounts.selectedRoleSources(accountId));
        world.bindEquipmentProfile(session.playerId, profile);
        broadcastRoomState(session.roomId);
      }
      await call.succ({confirmation,
        owned: {
          base: [...owned.base.values()].map(record => ({name: record.name, fields: [...record.fields]})),
          equipment: [...owned.equipment.values()].map(record => ({name: record.name, fields: [...record.fields]})),
        }, profile: {bytes: [...profile.bytes], strings: profile.strings}});
    } catch (error) {
      await call.error(error instanceof Error ? error.message : '战车迷彩更换失败', {code: 'TANK_TEXTURES_REJECTED'});
    }
  });
}
