import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {WsClient} from 'tsrpc';
import {serviceProto} from '../apps/shared/protocols/serviceProto';

async function main(): Promise<void> {
  const directory = mkdtempSync(join(tmpdir(), 'cdtank-pet-shop-fields-'));
  const server = spawn(process.execPath, ['dist/release/server/server/src/index.js'], {
    env: {...process.env, PORT: '3572', ACCOUNT_DB_PATH: join(directory, 'accounts.sqlite')},
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  server.stdout.on('data', chunk => {log += String(chunk);});
  server.stderr.on('data', chunk => {log += String(chunk);});
  const client = new WsClient(serviceProto, {server: 'ws://127.0.0.1:3572', logger: undefined});
  try {
    const deadline = Date.now() + 8000;
    while (!log.includes('Server started at 3572.')) {
      assert(server.exitCode === null, log);
      assert(Date.now() < deadline, log);
      await new Promise(resolve => setTimeout(resolve, 30));
    }
    assert((await client.connect()).isSucc);
    assert((await client.callApi('Account', {})).isSucc);
    const before = await client.callApi('Inventory', {});
    assert(before.isSucc);
    const result = await client.callApi('PetShop', {operation: 'QUERY'});
    assert(result.isSucc);
    const table: {rows: {values: Record<string, string>}[]} = JSON.parse(
      readFileSync('recovery/output/verified/tables/pet.json', 'utf8'));
    const expected = table.rows.map(row => row.values).filter(row => Number(row.PetMoney) > 0);
    assert.equal(result.res.pets.length, expected.length);
    for (const source of expected) {
      const product = result.res.pets.find(pet => pet.petId === Number(source.ID));
      assert(product);
      assert.equal(product.name, source.PetName);
      assert.equal(product.petType, Number(source.PetType));
      assert.equal(product.petSize, Number(source.PetSize));
      assert.equal(product.tokenPrice, Number(source.PetCoin));
    }
    const after = await client.callApi('Inventory', {});
    assert(after.isSucc);
    assert.deepEqual(after.res, before.res);
    writeFileSync('recovery/output/pet-shop-source-fields-network.json', JSON.stringify({
      status: 'PASS_COMPILED_PET_SHOP_QUERY_SOURCE_FIELDS', port: 3572,
      source: 'Original43a91c loader field contract and verified PetTable',
      products: result.res.pets.map(pet => ({petId: pet.petId, name: pet.name,
        petType: pet.petType, petSize: pet.petSize, tokenPrice: pet.tokenPrice})),
      inventoryUnchanged: true,
      account: 'Ordinary new Account; no funds, inventory or role fixture',
      scope: 'Compiled authenticated PetShop QUERY; no BUY or gameplay policy acceptance',
    }, null, 2) + '\n');
    console.log('PASS compiled PetShop QUERY type/size/rawPetCoin; inventory unchanged');
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
