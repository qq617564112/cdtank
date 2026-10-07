import type {ReqStackItemSale, ResStackItemSale} from '../../../shared/protocols/PtlStackItemSale';
import type {ReqPartSale, ResPartSale} from '../../../shared/protocols/PtlPartSale';
import type {ReqPartMaintenance, ResPartMaintenance} from '../../../shared/protocols/PtlPartMaintenance';
import type {ReqShop, ResShop} from '../../../shared/protocols/PtlShop';
import type {ReqTankShop, ResTankShop} from '../../../shared/protocols/PtlTankShop';
import type {ReqPetShop, ResPetShop} from '../../../shared/protocols/PtlPetShop';
import type {ReqKitbag, ResKitbag} from '../../../shared/protocols/PtlKitbag';
import type {ReqEquipment, ResEquipment} from '../../../shared/protocols/PtlEquipment';
import type {ReqSelectRole, ResSelectRole} from '../../../shared/protocols/PtlSelectRole';
import type {ResRoleProfile} from '../../../shared/protocols/PtlRoleProfile';
import type {ResOwnedRoles} from '../../../shared/protocols/PtlOwnedRoles';
import type {ResInventory} from '../../../shared/protocols/PtlInventory';
import type {WsClient} from 'tsrpc-browser';
import type {ServiceType} from '../../../shared/protocols/serviceProto';
import type {ReqTankTextures, ResTankTextures} from '../../../shared/protocols/PtlTankTextures';
import type {ReqPetSkillLearning, ResPetSkillLearning} from '../../../shared/protocols/PtlPetSkillLearning';
import type {ReqTankMaintenance, ResTankMaintenance} from '../../../shared/protocols/PtlTankMaintenance';
import type {ReqOwnedRoleSale, ResOwnedRoleSale} from '../../../shared/protocols/PtlOwnedRoleSale';
import type {ResHistory} from '../../../shared/protocols/PtlHistory';
import type {ReqTankUpgrade, ResTankUpgrade} from '../../../shared/protocols/PtlTankUpgrade';
import type {ResPlayerProfile} from '../../../shared/protocols/PtlPlayerProfile';
import type {ReqValuableItemSale, ResValuableItemSale} from '../../../shared/protocols/PtlValuableItemSale';
import type {ResAccount} from '../../../shared/protocols/PtlAccount';

export interface AccountContext {
  readonly identity?: ResAccount;
  readonly generation: number;
}

/** Account operations over the authenticated transport owned by GameConnection. */
export class AccountConnection {
  constructor(private readonly client: WsClient<ServiceType>,
      private readonly ensureConnected: () => Promise<void>) {}

  async displayName(name?: string): Promise<string> {
    await this.ensureConnected();
    const result = await this.client.callApi('DisplayName', name === undefined ? {} : {name});
    if (!result.isSucc) throw new Error(result.err.message);
    return result.res.name;
  }

  async shop(request: ReqShop): Promise<ResShop> {
    await this.ensureConnected();
    const result = await this.client.callApi('Shop', request);
    if (!result.isSucc) throw new Error(result.err.message);
    return result.res;
  }

  async tankShop(request: ReqTankShop): Promise<ResTankShop> {
    await this.ensureConnected();
    const result = await this.client.callApi('TankShop', request);
    if (!result.isSucc) throw new Error(result.err.message);
    return result.res;
  }

  async petShop(request: ReqPetShop): Promise<ResPetShop> {
    await this.ensureConnected();
    const result = await this.client.callApi('PetShop', request);
    if (!result.isSucc) throw new Error(result.err.message);
    return result.res;
  }

  async history(offset = 0, limit = 20): Promise<ResHistory> {
    await this.ensureConnected();
    const result = await this.client.callApi('History', {offset, limit});
    if (!result.isSucc) throw new Error(result.err.message);
    return result.res;
  }

  async inventory(): Promise<ResInventory> {
    await this.ensureConnected();
    const result = await this.client.callApi('Inventory', {});
    if (!result.isSucc) throw new Error(result.err.message);
    return result.res;
  }

  async ownedRoles(): Promise<ResOwnedRoles> {
    await this.ensureConnected();
    const result = await this.client.callApi('OwnedRoles', {});
    if (!result.isSucc) throw new Error(result.err.message);
    return result.res;
  }

  async roleProfile(selectTitleId?: number): Promise<ResRoleProfile> {
    await this.ensureConnected();
    const result = await this.client.callApi('RoleProfile', selectTitleId === undefined ? {} : {selectTitleId});
    if (!result.isSucc) throw new Error(result.err.message);
    return result.res;
  }

  async playerProfile(targetAccountId: string): Promise<ResPlayerProfile> {
    await this.ensureConnected();
    const result = await this.client.callApi('PlayerProfile', {targetAccountId});
    if (!result.isSucc) throw new Error(result.err.message);
    return result.res;
  }

  async selectRole(request: ReqSelectRole): Promise<ResSelectRole> {
    await this.ensureConnected();
    const result = await this.client.callApi('SelectRole', request);
    if (!result.isSucc) throw new Error(result.err.message);
    return result.res;
  }

  async equipment(request: ReqEquipment): Promise<ResEquipment> {
    await this.ensureConnected();
    const result = await this.client.callApi('Equipment', request);
    if (!result.isSucc) throw new Error(result.err.message);
    return result.res;
  }

  async configureKitbag(request: ReqKitbag): Promise<ResKitbag> {
    await this.ensureConnected();
    const result = await this.client.callApi('Kitbag', request);
    if (!result.isSucc) throw new Error(result.err.message);
    return result.res;
  }

  async configureTankTextures(request: ReqTankTextures): Promise<ResTankTextures> {
    await this.ensureConnected();
    const result = await this.client.callApi('TankTextures', request);
    if (!result.isSucc) throw new Error(result.err.message);
    return result.res;
  }

  async petSkillLearning(request: ReqPetSkillLearning, context: AccountContext,
    isCurrent: (context: AccountContext) => boolean): Promise<ResPetSkillLearning> {
    await this.ensureConnected();
    if (!isCurrent(context)) throw new Error('账户或连接已变化，请重新操作');
    const result = await this.client.callApi('PetSkillLearning', request);
    if (!result.isSucc) {
      const error = new Error(result.err.message) as Error & {code?: string | number};
      error.code = result.err.code;
      throw error;
    }
    return result.res;
  }

  async stackItemSale(request: ReqStackItemSale): Promise<ResStackItemSale> {
    await this.ensureConnected();
    const result = await this.client.callApi('StackItemSale', request);
    if (!result.isSucc) throw new Error(result.err.message);
    return result.res;
  }

  async valuableItemSale(request: ReqValuableItemSale, context: AccountContext,
    isCurrent: (context: AccountContext) => boolean): Promise<ResValuableItemSale> {
    await this.ensureConnected();
    if (!isCurrent(context)) throw new Error('账户或连接已变化，请重新操作');
    const result = await this.client.callApi('ValuableItemSale', request);
    if (!result.isSucc) {
      const error = new Error(result.err.message) as Error & {code?: string};
      error.code = result.err.code;
      throw error;
    }
    return result.res;
  }

  async partSale(request: ReqPartSale): Promise<ResPartSale> {
    await this.ensureConnected();
    const result = await this.client.callApi('PartSale', request);
    if (!result.isSucc) throw new Error(result.err.message);
    return result.res;
  }

  async partMaintenance(request: ReqPartMaintenance): Promise<ResPartMaintenance> {
    await this.ensureConnected();
    const result = await this.client.callApi('PartMaintenance', request);
    if (!result.isSucc) throw new Error(result.err.message);
    return result.res;
  }

  async tankMaintenance(request: ReqTankMaintenance): Promise<ResTankMaintenance> {
    await this.ensureConnected();
    const result = await this.client.callApi('TankMaintenance', request);
    if (!result.isSucc) throw new Error(result.err.message);
    return result.res;
  }

  async tankUpgrade(request: ReqTankUpgrade): Promise<ResTankUpgrade> {
    await this.ensureConnected();
    const result = await this.client.callApi('TankUpgrade', request);
    if (!result.isSucc) throw new Error(result.err.message);
    return result.res;
  }

  async ownedRoleSale(request: ReqOwnedRoleSale): Promise<ResOwnedRoleSale> {
    await this.ensureConnected();
    const result = await this.client.callApi('OwnedRoleSale', request);
    if (!result.isSucc) throw new Error(result.err.message);
    return result.res;
  }
}
