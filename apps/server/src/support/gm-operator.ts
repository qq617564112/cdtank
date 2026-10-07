import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {GmSupportStore} from './gm-support';

const [command, ...args] = process.argv.slice(2);
const accountPath = resolve(process.env.ACCOUNT_DB_PATH ?? 'recovery/output/accounts.sqlite');

if (!existsSync(accountPath)) {
  console.error(`账户数据库不存在: ${accountPath}`);
  process.exitCode = 1;
} else {
  const database = new DatabaseSync(accountPath);
  try {
    const support = new GmSupportStore(database);
    if (command === 'list') {
      let afterId = 0;
      if (args.length === 2 && args[0] === '--after') afterId = parseCursor(args[1]);
      else if (args.length !== 0) throw new Error('Usage: gm-operator.ts list [--after <questionId>]');
      const questions = support.unreplied(afterId);
      for (const question of questions) console.log(JSON.stringify(question));
    } else if (command === 'reply' && args.length === 2) {
      const reply = support.reply(parseQuestionId(args[0]), args[1]);
      console.log(String(reply.id));
    } else {
      throw new Error('Usage: gm-operator.ts list [--after <questionId>] | reply <questionId> <text>');
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'GM操作失败');
    process.exitCode = 1;
  } finally {
    database.close();
  }
}

function parseCursor(value: string): number {
  const cursor = Number(value);
  if (!Number.isSafeInteger(cursor) || cursor < 0) throw new Error('问题游标无效');
  return cursor;
}

function parseQuestionId(value: string): number {
  const questionId = Number(value);
  if (!Number.isSafeInteger(questionId) || questionId <= 0) throw new Error('问题ID无效');
  return questionId;
}
