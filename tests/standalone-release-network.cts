import assert from 'node:assert/strict';
import {spawn, spawnSync, type ChildProcess} from 'node:child_process';
import {existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {createServer} from 'node:http';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {WsClient} from 'tsrpc';
import {serviceProto} from '../apps/shared/protocols/serviceProto';
import type {MsgRoomSnapshot} from '../apps/shared/protocols';

async function main() {
  const workspace = process.cwd();
  const directory = mkdtempSync(join(tmpdir(), 'cdtank-release-'));
  const release = join(directory, 'release');
  const output = resolve(workspace, `recovery/output/standalone-release-network-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  const evidence: Record<string, unknown> = {status: 'RUNNING',
    scope: 'Local independent release, two ordinary accounts, room join/leave and cold account restart',
    port: 3432, fixtures: 'None; empty newly authenticated accounts, no imported funds/roles/inventory',
    limits: ['No independent physical device', 'No nginx proxy or browser rendering assertion']};
  let server: ChildProcess | undefined;
  let serverLog = '';
  const clients = [0, 1].map(() => new WsClient(serviceProto, {server: 'ws://127.0.0.1:3432', logger: undefined}));
  const snapshots: (MsgRoomSnapshot | undefined)[] = [undefined, undefined];
  clients.forEach((client, index) => client.listenMsg('RoomSnapshot', value => {snapshots[index] = value;}));
  const wait = async (condition: () => boolean) => {
    const deadline = Date.now() + 15000;
    while (!condition() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
    assert(condition(), serverLog.slice(-2000));
  };
  const stop = async () => {
    await Promise.all(clients.map(client => client.disconnect()));
    if (server?.exitCode === null) {
      const ended = new Promise(resolve => server!.once('exit', resolve));
      server.kill('SIGTERM'); await ended;
    }
  };
  const start = async () => {
    const env: NodeJS.ProcessEnv = {...process.env, PORT: '3432'};
    for (const key of ['NODE_PATH', 'NODE_OPTIONS', 'CONTENT_TABLES', 'WEB_ASSETS', 'ACCOUNT_DB_PATH',
      'SCENE_PLACEMENTS', 'BATTLEFIELDS', 'MATCH_MIN_PLAYERS', 'MATCH_TIME_LIMIT_SECONDS']) delete env[key];
    serverLog = '';
    server = spawn(process.execPath, [join(release, 'start.mjs')], {
      cwd: directory, env, stdio: ['ignore', 'pipe', 'pipe'],
    });
    server.stdout!.on('data', value => {serverLog += String(value);});
    server.stderr!.on('data', value => {serverLog += String(value);});
    await wait(() => serverLog.includes('Server started'));
  };
  try {
    const packed = spawnSync(process.execPath, ['scripts/package-release.mjs', release], {cwd: workspace, encoding: 'utf8'});
    assert.equal(packed.status, 0, packed.stderr);
    assert(!existsSync(join(release, 'state/accounts.sqlite')));
    const installed = spawnSync('npm', ['ci', '--omit=dev', '--ignore-scripts', '--no-audit', '--no-fund'], {
      cwd: join(release, 'server'), encoding: 'utf8', timeout: 120000,
    });
    assert.equal(installed.status, 0, installed.stderr);
    const resolution = spawnSync(process.execPath, ['-p', "require.resolve('tsrpc')"], {
      cwd: join(release, 'server'), env: {...process.env, NODE_PATH: ''}, encoding: 'utf8',
    });
    assert.equal(resolution.status, 0); assert(resolution.stdout.startsWith(join(release, 'server/node_modules/')));
    evidence.runtimeDependencies = 'npm ci with release-only lock; tsrpc resolves inside release';
    const collision = spawnSync(process.execPath, [resolve(workspace, 'scripts/package-release.mjs'), release], {encoding: 'utf8'});
    assert.notEqual(collision.status, 0);
    const http = createServer((request, response) => {
      const filename = join(release, 'web', request.url === '/' ? 'index.html' : request.url!);
      if (!existsSync(filename)) {response.writeHead(404); response.end(); return;}
      response.end(readFileSync(filename));
    });
    await new Promise<void>(resolve => http.listen(8432, '127.0.0.1', resolve));
    try {
      const html = await (await fetch('http://127.0.0.1:8432/')).text();
      assert(html.includes('<div id="app">'));
      const entry = html.match(/src="([^"]+\.js)"/)![1];
      const js = await fetch(`http://127.0.0.1:8432${entry}`); assert.equal(js.status, 200); assert((await js.text()).length > 0);
      const catalog = await (await fetch('http://127.0.0.1:8432/combat-catalog.json')).json();
      assert(catalog.items.length > 0);
      evidence.web = {formalEntry: true, javascriptEntry: entry, combatCatalog: true,
        provider: 'test HTTP server reading the assembled static release'};
    } finally {await new Promise<void>((resolve, reject) => http.close(error => error ? reject(error) : resolve()));}
    await start();
    const accountIds: string[] = [], tokens: string[] = [];
    for (const client of clients) {
      assert((await client.connect()).isSucc);
      const account = await client.callApi('Account', {}); assert(account.isSucc);
      accountIds.push(account.res.accountId); tokens.push(account.res.token);
    }
    assert.notEqual(accountIds[0], accountIds[1]);
    assert((await clients[0].callApi('DisplayName', {name: '独立部署甲'})).isSucc);
    const maps = await clients[0].callApi('ListMaps', {}); assert(maps.isSucc);
    assert(maps.res.maps.some(map => map.mode === 1 && map.mapId === 7));
    const room = await clients[0].callApi('CreateRoom', {mode: 1, mapId: 7, roomName: '独立部署房间', name: '甲', tankId: 1});
    assert(room.isSucc);
    const joined = await clients[1].callApi('Join', {roomId: room.res.room.id, name: '乙', clientId: '', tankId: 1});
    assert(joined.isSucc);
    await wait(() => snapshots.every(snapshot => snapshot?.players.length === 2));
    assert.deepEqual(snapshots[0]!.players, snapshots[1]!.players);
    evidence.room = {id: room.res.room.id, mode: 1, mapId: 7, players: snapshots[0]!.players.map(player => player.id), dualSnapshot: true};
    for (const client of clients) assert((await client.callApi('Leave', {roomId: room.res.room.id, round: room.res.room.round!})).isSucc);
    const rooms = await clients[0].callApi('ListRooms', {}); assert(rooms.isSucc); assert(!rooms.res.rooms.some(value => value.id === room.res.room.id));
    await stop();
    assert(existsSync(join(release, 'state/accounts.sqlite')));
    await start();
    for (const [index, client] of clients.entries()) {
      assert((await client.connect()).isSucc);
      const account = await client.callApi('Account', {token: tokens[index]}); assert(account.isSucc);
      assert.equal(account.res.accountId, accountIds[index]);
    }
    const name = await clients[0].callApi('DisplayName', {}); assert(name.isSucc); assert.equal(name.res.name, '独立部署甲');
    const empty = await clients[1].callApi('Inventory', {}); assert(empty.isSucc); assert.equal(empty.res.records.length, 0);
    evidence.persistence = {accountIds, nickname: name.res.name, otherInventoryEmpty: true, coldRestart: true};
    evidence.status = 'PASS_LOCAL_STANDALONE_RELEASE_SCOPE';
    console.log(`PASS ${output}`);
  } catch (error) {evidence.status = 'FAIL'; evidence.error = String(error); throw error;}
  finally {
    await stop(); rmSync(directory, {recursive: true, force: true}); evidence.cleaned = true;
    writeFileSync(output, JSON.stringify(evidence, null, 2) + '\n');
  }
}
void main().catch(error => {console.error(error); process.exitCode = 1;});
