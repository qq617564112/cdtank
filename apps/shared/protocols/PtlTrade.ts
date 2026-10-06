import type {OwnedRoleRecordData, ResOwnedRoles} from './PtlOwnedRoles';
import type {InventoryWireRecord, ResInventory} from './PtlInventory';

export interface TradeRecordRef {
  kind: 'pet' | 'tank' | 'item';
  instanceId: number;
  /** Original stack categories transfer quantity; durable records transfer one instance. */
  quantity?: number;
}
export interface TradeOffer {
  money: number;
  originality: number;
  skillPoints: number;
  records: TradeRecordRef[];
}
export interface TradeRecordView extends TradeRecordRef {
  role?: OwnedRoleRecordData;
  item?: InventoryWireRecord;
}
export interface TradeAccount {
  accountId: string;
  wallet?: {money: number; originality: number; skillPoints: number};
  owned: ResOwnedRoles;
  inventory: ResInventory;
  profile?: {bytes: number[]; strings: [string, string]};
}
export interface TradeParty {
  accountId: string;
  name: string;
  offer: TradeOffer;
  records: TradeRecordView[];
  shown: boolean;
  confirmed: boolean;
}
export interface TradeSession {
  id: string;
  revision: number;
  phase: 'INVITED' | 'OPEN' | 'COMPLETED' | 'CANCELLED';
  inviterAccountId: string;
  parties: TradeParty[];
  reason?: string;
}
/** Web authority transports recovered offer/show/confirm/cancel actions. */
export interface ReqTrade {
  operation: 'QUERY' | 'INVITE' | 'RESPOND' | 'OFFER' | 'SHOW' | 'UNSHOW' | 'CONFIRM' | 'CANCEL';
  targetAccountId?: string;
  sessionId?: string;
  accept?: boolean;
  offer?: TradeOffer;
  expectedRevision?: number;
}
export interface ResTrade {
  session?: TradeSession;
  account: TradeAccount;
}
