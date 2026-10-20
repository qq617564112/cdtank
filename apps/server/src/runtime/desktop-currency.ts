import type {AccountStore} from '../account-store';
import type {LocalCurrencyCommand, LocalCurrencyReply} from '../../../shared/contracts/local-currency';

/** Desktop operations are available only to the parent that spawned this server. */
export function registerDesktopCurrency(accounts: AccountStore): void {
  if (!process.send) return;
  process.on('message', message => {
    const request = message as LocalCurrencyCommand;
    if (request?.type !== 'credit-local-currency') return;
    let reply: LocalCurrencyReply;
    try {reply = {type: 'local-currency-result', id: request.id, balance: accounts.creditLocalCurrency(request.credit)};}
    catch (error) {
      reply = {type: 'local-currency-result', id: request.id, error: error instanceof Error ? error.message : '充值失败。'};
    }
    if (process.connected) process.send?.(reply, () => {});
  });
}
