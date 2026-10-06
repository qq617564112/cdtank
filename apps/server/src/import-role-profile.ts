import {readFileSync} from 'node:fs';
import {AccountStore} from './account-store';

const [accountId, inputPath] = process.argv.slice(2);
if (!accountId || !inputPath) throw new Error('Usage: profile:import -- <accountId> <profile.json>');
const input: {bytes: number[]; strings: [string, string]} = JSON.parse(readFileSync(inputPath, 'utf8'));
if (!Array.isArray(input.bytes) || input.bytes.length !== 0x170 ||
    input.bytes.some(value => !Number.isInteger(value) || value < 0 || value > 255) ||
    !Array.isArray(input.strings) || input.strings.length !== 2 ||
    input.strings.some(value => typeof value !== 'string')) {
  throw new Error('原角色资料必须包含368个字节值及两个字符串');
}
const store = new AccountStore(process.env.ACCOUNT_DB_PATH ?? 'recovery/output/accounts.sqlite');
try {
  store.replaceRoleProfile(accountId, {bytes: new Uint8Array(input.bytes), strings: input.strings});
  console.log(`Imported recovered role profile for ${accountId}.`);
} finally {
  store.close();
}
