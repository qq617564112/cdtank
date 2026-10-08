import {resolve} from 'node:path';

function positiveInteger(name: string, fallback: number, maximum: number): number {
  const raw = process.env[name];
  const value = raw === undefined ? fallback : Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > maximum) {
    throw new Error(`${name} must be an integer between 1 and ${maximum}`);
  }
  return value;
}

export function serverRuntimeConfig(): {
  port: number; tickRate: number; accountPath: string; webRoot: string;
  minPlayers?: number; timeLimitSeconds?: number;
} {
  const timeLimit = process.env.MATCH_TIME_LIMIT_SECONDS;
  const seconds = timeLimit === undefined ? undefined : Number(timeLimit);
  if (seconds !== undefined && (!Number.isFinite(seconds) || seconds <= 0)) {
    throw new Error('MATCH_TIME_LIMIT_SECONDS must be positive');
  }
  return {port: positiveInteger('PORT', 3001, 65535),
    tickRate: positiveInteger('TICK_RATE', 20, 1000),
    accountPath: resolve(process.env.ACCOUNT_DB_PATH ?? 'recovery/output/accounts.sqlite'),
    webRoot: resolve(process.env.WEB_ROOT ?? 'dist/web'),
    minPlayers: process.env.MATCH_MIN_PLAYERS === undefined ? undefined
      : positiveInteger('MATCH_MIN_PLAYERS', 1, 12),
    timeLimitSeconds: seconds};
}
