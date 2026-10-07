import type {WsServer} from 'tsrpc';
import type {ServiceType} from '../../../shared/protocols/serviceProto';
import type {CombatCatalog} from '../../../shared/combat/catalog';
import type {AccountStore} from '../account-store';
import type {World} from '../world';

export function registerPetSkillLearningApi(server: WsServer<ServiceType>, accounts: AccountStore,
  world: World, catalog: CombatCatalog, identities: ReadonlyMap<string, string>,
  sessions: ReadonlyMap<string, {roomId: string; playerId: string}>, broadcast: (roomId: string) => void): void {
  server.implementApi('PetSkillLearning', async call => {
    const accountId = identities.get(call.conn.id);
    if (!accountId) return call.error('请先登录账户', {code: 'ACCOUNT_REQUIRED'});
    const session = sessions.get(call.conn.id);
    if (call.req.operation === 'LEARN' && session && !world.canConfigureInventory(session.playerId)) {
      return call.error('请在准备阶段学习宠物技能', {code: 'PET_LEARNING_REJECTED'});
    }
    try {
      const result = accounts.petSkillLearning(accountId, call.req, catalog);
      if (session && call.req.operation === 'LEARN' && result.learned && !result.replayed) {
        world.bindRoleSources(session.playerId, accounts.selectedRoleSources(accountId));
        world.bindEquipmentProfile(session.playerId, accounts.roleProfile(accountId)!);
        broadcast(session.roomId);
      }
      await call.succ(result);
    } catch (error) {
      await call.error(error instanceof Error ? error.message : '宠物技能学习失败', {code: 'PET_LEARNING_REJECTED'});
    }
  });
}
