import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {WsClient} from 'tsrpc';
import {serviceProto} from '../apps/shared/protocols/serviceProto';

async function main(): Promise<void> {
  const directory = mkdtempSync(join(tmpdir(), 'cdtank-tank-shop-fields-'));
  const server = spawn(process.execPath, ['dist/release/server/server/src/index.js'], {
    env: {...process.env, PORT: '3573', ACCOUNT_DB_PATH: join(directory, 'accounts.sqlite')},
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  server.stdout.on('data', chunk => {log += String(chunk);});
  server.stderr.on('data', chunk => {log += String(chunk);});
  const client = new WsClient(serviceProto, {server: 'ws://127.0.0.1:3573', logger: undefined});
  try {
    const deadline = Date.now() + 8000;
    while (!log.includes('Server started at 3573.')) {
      assert(server.exitCode === null, log);
      assert(Date.now() < deadline, log);
      await new Promise(resolve => setTimeout(resolve, 30));
    }
    assert((await client.connect()).isSucc);
    assert((await client.callApi('Account', {})).isSucc);
    const before = await client.callApi('Inventory', {});
    assert(before.isSucc);
    const result = await client.callApi('TankShop', {operation: 'QUERY'});
    assert(result.isSucc);
    const table: {rows: {values: Record<string, string>}[]} = JSON.parse(
      readFileSync('recovery/output/verified/tables/tankshop.json', 'utf8'));
    const tanks: {rows: {values: Record<string, string>}[]} = JSON.parse(
      readFileSync('recovery/output/verified/tables/tank.json', 'utf8'));
    const definitions = new Map(tanks.rows.map(row => [Number(row.values.ID), row.values]));
    const expected = table.rows.map(row => row.values).filter(row => Number(row['坦克金钱价']) > 0 && row['购买方式'] === '2');
    assert.equal(result.res.tanks.length, expected.length);
    for (const source of expected) {
      const definition = definitions.get(Number(source['坦克ID']));
      assert(definition);
      const product = result.res.tanks.find(tank => tank.tankId === Number(source['坦克ID']));
      assert(product);
      assert.equal(product.name, definition.TankName);
      assert.equal(product.tankType, Number(definition.TankType));
      assert.equal(product.defaultDurability, Number(source['耐久度默认']));
      assert.equal(product.tokenPrice, Number(source['坦克代币价']));
    }
    const after = await client.callApi('Inventory', {});
    assert(after.isSucc);
    assert.deepEqual(after.res, before.res);
    writeFileSync('recovery/output/tank-shop-source-fields-network.json', JSON.stringify({
      status: 'PASS_COMPILED_TANK_SHOP_QUERY_SOURCE_FIELDS', port: 3573,
      source: 'Original43b375 Tankshop and43b62a TankTable field contracts',
      products: result.res.tanks.map(tank => ({tankId: tank.tankId, name: tank.name,
        tankType: tank.tankType, defaultDurability: tank.defaultDurability, tokenPrice: tank.tokenPrice})),
      inventoryUnchanged: true,
      account: 'Ordinary new Account; no funds, inventory or role fixture',
      scope: 'Compiled authenticated TankShop QUERY; no BUY or gameplay policy acceptance',
    }, null, 2) + '\n');
    console.log('PASS compiled TankShop QUERY type/size/rawTankshopCoin; inventory unchanged');
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
