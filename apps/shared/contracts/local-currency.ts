export const LOCAL_CURRENCY_LIMITS = {tokens: 0xffffffff, money: 999999999} as const;

/** Amounts to add to a registered account on the desktop's local server. */
export interface LocalCurrencyCredit {
  account: string;
  tokens: number;
  money: number;
}

export interface LocalCurrencyBalance {
  account: string;
  tokens: number;
  money: number;
}

export interface LocalCurrencyCommand {
  type: 'credit-local-currency';
  id: number;
  credit: LocalCurrencyCredit;
}

export type LocalCurrencyReply = {type: 'local-currency-result'; id: number; balance: LocalCurrencyBalance}
  | {type: 'local-currency-result'; id: number; error: string};
