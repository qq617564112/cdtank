import {readFileSync} from 'node:fs';
import {AccountStore} from './account-store';
import type {InventoryWireRecord} from '../../shared/protocols/PtlInventory';

const [accountId, inputPath] = process.argv.slice(2);
if (!accountId || !inputPath) throw new Error('Usage: npm run inventory:import -- <accountId> <records.json>');
const records = JSON.parse(readFileSync(inputPath, 'utf8')) as InventoryWireRecord[];
const store = new AccountStore(process.env.ACCOUNT_DB_PATH ?? 'recovery/output/accounts.sqlite');
try {
  store.replaceInventory(accountId, records);
  console.log(`Imported ${records.length} owned records for account ${accountId}; reconnect to refresh the room inventory.`);
} finally {
  store.close();
}
