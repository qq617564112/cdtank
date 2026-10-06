import assert from 'node:assert/strict';
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {TSBuffer} from 'tsbuffer';
import {AccountStore} from '../apps/server/src/account-store';
import {registerAccountApis} from '../apps/server/src/accounts/api';
import {readRoleProfilePlayerSummary} from '../apps/server/src/accounts/profile/player-summary';
import {serviceProto} from '../apps/shared/protocols/serviceProto';
import type {ResRoleProfile} from '../apps/shared/protocols/PtlRoleProfile';
import type {RoleProfilePayload} from '../apps/server/src/accounts/profile/payload';

async function main(): Promise<void> {
  const source = JSON.parse(readFileSync('recovery/output/home-player-profile-numeric-native.json', 'utf8'));
  const offsets = {score: 0x5c, originality: 0x9c, tech: 0xa0};
  for (const row of source.nativeGetterRows) {
    const bytes = new Uint8Array(0x170);
    new DataView(bytes.buffer).setUint32(offsets[row.field as keyof typeof offsets], row.bits, true);
    const before = [...bytes];
    const result = readRoleProfilePlayerSummary({bytes, strings: ['', '']});
    assert.equal(String(result[row.field as keyof typeof result]), row.signedDecimalText);
    assert.deepEqual([...bytes], before);
  }
  const directory = mkdtempSync(join(tmpdir(), 'cdtank-player-summary-'));
  const store = new AccountStore(join(directory, 'accounts.sqlite'));
  try {
    const owner = store.open(), absent = store.open();
    const bytes = new Uint8Array(0x170), view = new DataView(bytes.buffer);
    view.setInt32(0x5c, 17, true); view.setInt32(0x9c, 123456789, true); view.setInt32(0xa0, -1, true);
    const profile: RoleProfilePayload = {bytes, strings: ['source fixture', '']};
    store.replaceRoleProfile(owner.accountId, profile);
    const handlers = new Map<string, (call: unknown) => Promise<void>>();
    const server = {implementApi: (name: string, handler: (call: unknown) => Promise<void>) => handlers.set(name, handler)};
    const identities = new Map([['owner', owner.accountId], ['absent', absent.accountId]]);
    registerAccountApis(server as Parameters<typeof registerAccountApis>[0], store,
      {} as Parameters<typeof registerAccountApis>[2], identities, new Map(), () => {}, () => {throw new Error('No role selection');});
    const invoke = async (id: string) => {
      let response: ResRoleProfile | undefined, code: string | undefined;
      await handlers.get('RoleProfile')!({conn: {id}, req: {},
        succ: (value: ResRoleProfile) => {response = value;},
        error: (_text: string, info: {code: string}) => {code = info.code;}});
      return {response, code};
    };
    assert.equal((await invoke('unknown')).code, 'ACCOUNT_REQUIRED');
    assert.deepEqual((await invoke('absent')).response, {});
    const result = (await invoke('owner')).response!;
    assert.deepEqual(result.playerSummary, {score: 17, originality: 123456789, tech: -1});
    assert.deepEqual(result.profile, {bytes: [...bytes], strings: profile.strings});
    const codec = new TSBuffer(serviceProto.types);
    for (const response of [result, {}]) {
      const wire = codec.encode(response, 'PtlRoleProfile/ResRoleProfile'); assert(wire.isSucc);
      const decoded = codec.decode(wire.buf, 'PtlRoleProfile/ResRoleProfile'); assert(decoded.isSucc);
      assert.deepEqual(decoded.value, response);
    }
    assert.deepEqual(store.roleProfile(owner.accountId), profile);
    assert.equal(store.roleProfile(absent.accountId), undefined);
    writeFileSync('recovery/output/home-player-summary-api.json', JSON.stringify({
      status: 'PASS_READ_ONLY_API_WIRE_NATIVE_GETTER_SCOPE', nativeRows: source.nativeGetterRows.length,
      result: result.playerSummary, absentProfileOmitted: true, accountIsolation: true,
      profileUnchanged: true, wireRoundtrip: true,
      fixture: 'Temporary account store with explicitly imported source-value payload; no earned-value claim.'
    }, null, 2) + '\n');
  } finally {store.close(); rmSync(directory, {recursive: true, force: true});}
}
void main().catch(error => {console.error(error); process.exitCode = 1;});
