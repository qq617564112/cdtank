import {readFileSync} from 'node:fs';
import {AccountStore} from './account-store';

const [accountId, inputPath] = process.argv.slice(2);
if (!accountId || !inputPath) throw new Error('Usage: npm run roles:import -- <accountId> <records.json>');
const input = JSON.parse(readFileSync(inputPath, 'utf8')) as {
  base: {name: string; fields: [number, number][]}[];
  equipment: {name: string; fields: [number, number][]}[];
};
const records = {
  base: input.base.map(record => ({name: record.name, fields: new Map(record.fields)})),
  equipment: input.equipment.map(record => ({name: record.name, fields: new Map(record.fields)})),
};
const store = new AccountStore(process.env.ACCOUNT_DB_PATH ?? 'recovery/output/accounts.sqlite');
try {
  store.replaceRoleRecords(accountId, records);
  console.log(`Imported ${records.base.length} base and ${records.equipment.length} equipment records for ${accountId}.`);
} finally {
  store.close();
}
