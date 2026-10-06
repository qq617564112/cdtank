import assert from 'node:assert/strict';
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import type {WsServer} from 'tsrpc';
import type {ServiceType} from '../apps/shared/protocols/serviceProto';
import type {ReqTrade, ResTrade} from '../apps/shared/protocols/PtlTrade';
import {AccountStore} from '../apps/server/src/account-store';
import {registerTradeApi} from '../apps/server/src/social/trade';

async function main() {
  const directory = mkdtempSync(join(tmpdir(), 'trade-show-'));
  const accounts = new AccountStore(join(directory, 'accounts.sqlite'));
  try {
    const identities = new Map<string, string>();
    for (const connection of ['a', 'b']) {
      const account = accounts.open(); identities.set(connection, account.accountId);
      const bytes = new Uint8Array(0x170);
      new DataView(bytes.buffer).setUint32(0x70, 1000, true);
      accounts.replaceRoleProfile(account.accountId, {bytes, strings: ['', '']});
    }
    let handler: (call: unknown) => Promise<void>;
    const server = {connections: [{id: 'a'}, {id: 'b'}], flows: {postDisconnectFlow: {push() {}}},
      implementApi(_name: string, callback: typeof handler) {handler = callback;}, async broadcastMsg() {}};
    registerTradeApi(server as unknown as WsServer<ServiceType>, accounts, identities, new Map());
    async function call(id: string, req: ReqTrade) {
      let result: ResTrade | undefined;
      await handler!({conn: {id}, req, async succ(value: ResTrade) {result = value;},
        error(message: string) {throw new Error(message);}});
      assert(result); return result;
    }
    let state = await call('a', {operation: 'INVITE', targetAccountId: identities.get('b')});
    const sessionId = state.session!.id;
    state = await call('b', {operation: 'RESPOND', sessionId, accept: true});
    const offerA = {money: 100, originality: 0, skillPoints: 0, records: []};
    const offerB = {...offerA, money: 200};
    state = await call('a', {operation: 'SHOW', sessionId, expectedRevision: state.session!.revision, offer: offerA});
    state = await call('b', {operation: 'SHOW', sessionId, expectedRevision: state.session!.revision, offer: offerB});
    assert.deepEqual(state.session!.parties.map(p => p.shown), [false, true]);
    state = await call('a', {operation: 'SHOW', sessionId, expectedRevision: state.session!.revision, offer: offerA});
    assert.deepEqual(state.session!.parties.map(p => p.shown), [true, true]);
    state = await call('a', {operation: 'CONFIRM', sessionId, expectedRevision: state.session!.revision});
    state = await call('b', {operation: 'SHOW', sessionId, expectedRevision: state.session!.revision, offer: {...offerB, money: 201}});
    assert.deepEqual(state.session!.parties.map(p => p.shown), [false, true]);
    assert.deepEqual(state.session!.parties.map(p => p.confirmed), [false, false]);
    writeFileSync('recovery/output/trade-show-session.json', JSON.stringify({
      status: 'PASS_INLINE_SHOW_UNCHANGED_RETAINS_PEER_CHANGED_RESETS_CONFIRMATION', fixtureOnly: true}, null, 2) + '\n');
  } finally {accounts.close(); rmSync(directory, {recursive: true, force: true});}
}
void main();
