import {existsSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {serverRuntimeConfig} from '../runtime/config';
import {FamilyStore} from './family';

const [command, ...args] = process.argv.slice(2);
const accountPath = serverRuntimeConfig().accountPath;

if (!existsSync(accountPath)) {
  console.error(`账户数据库不存在: ${accountPath}`);
  process.exitCode = 1;
} else {
  const database = new DatabaseSync(accountPath);
  try {
    const families = new FamilyStore(database);
    if (command === 'assign' && args.length === 3) {
      families.assign(validText(args[0], '账户ID'), validText(args[1], '家族ID'),
        validText(args[2], '家族名称'));
    } else if (command === 'remove' && args.length === 1) {
      families.remove(validText(args[0], '账户ID'));
    } else if (command === 'list' && args.length <= 1) {
      const familyId = args.length === 1 ? validText(args[0], '家族ID') : undefined;
      for (const membership of families.list(familyId)) console.log(JSON.stringify(membership));
    } else {
      throw new Error('Usage: family-operator.ts assign <accountId> <familyId> <familyName> | remove <accountId> | list [familyId]');
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : '家族操作失败');
    process.exitCode = 1;
  } finally {
    database.close();
  }
}

function validText(value: string, label: string): string {
  const trimmed = value?.trim();
  if (!trimmed || /[\u0000-\u001f\u007f]/.test(trimmed)) throw new Error(`${label}无效`);
  return trimmed;
}
