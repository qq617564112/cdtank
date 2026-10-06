import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {transpileModule, ModuleKind, JsxEmit, ScriptTarget} from 'typescript';
import type {BattleMatch as MatchType} from '../apps/web/src/interface/battle/battle-match';
import type {MsgRoomSnapshot} from '../apps/shared/protocols';

const source = readFileSync('apps/web/src/interface/battle/battle-match.tsx', 'utf8');
const compiled = transpileModule(source, {compilerOptions: {
  module: ModuleKind.CommonJS, jsx: JsxEmit.ReactJSX, target: ScriptTarget.ES2022,
}}).outputText;
const exported = {} as {BattleMatch: typeof MatchType};
runInNewContext(compiled, {exports: exported, Error,
  require: (id: string) => id.startsWith('.') ? {} : require(id)});
const {BattleMatch} = exported;
const raw = JSON.parse(readFileSync(
  'recovery/output/browser-death-countdown-2026-10-04T18-12-10-607Z.json', 'utf8'));
const snapshot = raw.failure[0].world as MsgRoomSnapshot & {playerId: string};

async function main(): Promise<void> {
  let calls = 0, leaveCalls = 0;
  let resolveReady: (() => void) | undefined;
  const panel = new BattleMatch(async () => {}, () => {
    calls++;
    return new Promise<void>(resolve => {resolveReady = resolve;});
  }, async () => {}, undefined, undefined, async () => {leaveCalls++;});
  panel.update(snapshot, snapshot.playerId);
  assert.equal(panel.getSnapshot()!.readyAvailable, false);
  panel.requestReady();
  assert.equal(calls, 0);
  await panel.waitingActions.leave();
  assert.equal(leaveCalls, 1, 'Loading must not prevent normal Leave');
  panel.setReadyAvailable(true);
  const available = panel.getSnapshot();
  panel.setReadyAvailable(true);
  assert.equal(panel.getSnapshot(), available, 'Unchanged render readiness must not republish');
  panel.requestReady();
  assert.equal(calls, 1);
  assert.equal(panel.getSnapshot()!.pending, true);
  panel.setReadyAvailable(false);
  assert.equal(panel.getSnapshot()!.pending, true, 'Resource updates preserve request ownership');
  panel.requestReady();
  assert.equal(calls, 1);
  resolveReady!();
  await new Promise<void>(resolve => setImmediate(resolve));
  assert.equal(panel.getSnapshot()!.pending, false);
  assert.equal(panel.getSnapshot()!.readyAvailable, false);
  panel.setReadyAvailable(true);
  panel.clear();
  panel.update(snapshot, snapshot.playerId);
  assert.equal(panel.getSnapshot()!.readyAvailable, false, 'Room exit clears old resource eligibility');
  console.log('PASS resource readiness, request ownership, loading Leave and new-room reset');
}
main().catch(error => {console.error(error); process.exitCode = 1;});
