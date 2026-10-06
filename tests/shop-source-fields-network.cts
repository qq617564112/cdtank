import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {WsClient} from 'tsrpc';
import {serviceProto} from '../apps/shared/protocols/serviceProto';
import type {ShopItem} from '../apps/shared/protocols/PtlShop';

async function main(): Promise<void> {
  const directory = mkdtempSync(join(tmpdir(), 'cdtank-shop-fields-network-'));
  const server = spawn(process.execPath, ['dist/release/server/server/src/index.js'], {
    env: {...process.env, PORT: '3571', ACCOUNT_DB_PATH: join(directory, 'accounts.sqlite')},
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  server.stdout.on('data', chunk => {log += String(chunk);});
  server.stderr.on('data', chunk => {log += String(chunk);});
  const client = new WsClient(serviceProto, {server: 'ws://127.0.0.1:3571', logger: undefined});
  try {
    const deadline = Date.now() + 8000;
    while (!log.includes('Server started at 3571.')) {
      assert(server.exitCode === null, log);
      assert(Date.now() < deadline, log);
      await new Promise(resolve => setTimeout(resolve, 30));
    }
    assert((await client.connect()).isSucc);
    assert((await client.callApi('Account', {})).isSucc);
    const before = await client.callApi('Inventory', {});
    assert(before.isSucc);
    const result = await client.callApi('Shop', {operation: 'QUERY'});
    assert(result.isSucc);
    const contract: {products: number; samples: ShopItem[]} = JSON.parse(
      readFileSync('recovery/output/shop-source-fields-contract.json', 'utf8'));
    assert.equal(result.res.items.length, contract.products);
    for (const sample of contract.samples) {
      assert.deepEqual(result.res.items.find(item => item.itemTableId === sample.itemTableId), sample);
    }
    const after = await client.callApi('Inventory', {});
    assert(after.isSucc);
    assert.deepEqual(after.res, before.res);
    writeFileSync('recovery/output/shop-source-fields-network.json', JSON.stringify({
      status: 'PASS_COMPILED_SHOP_QUERY_SOURCE_FIELDS', port: 3571,
      products: result.res.items.length, samples: contract.samples,
      inventoryUnchanged: true, account: 'Ordinary new Account; no profile, funds or inventory fixture',
      scope: 'Released compiled server Account/Shop QUERY metadata; no BUY or gameplay policy acceptance.',
    }, null, 2) + '\n');
    console.log('PASS compiled Shop QUERY getMethod/durable; inventory unchanged');
  } finally {
    await client.disconnect();
    if (server.exitCode === null) {
      server.kill('SIGTERM');
      await new Promise(resolve => server.once('exit', resolve));
    }
    rmSync(directory, {recursive: true, force: true});
  }
}

void main().catch(error => {console.error(error); process.exitCode = 1;});
