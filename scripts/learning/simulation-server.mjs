import {spawn, execFileSync} from 'node:child_process';
import {createServer} from 'node:http';
import {dirname, resolve} from 'node:path';
import {availableParallelism} from 'node:os';
import {createInterface} from 'node:readline';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';

const {values} = parseArgs({options: {
  host: {type: 'string', default: '0.0.0.0'},
  port: {type: 'string', default: '40109'},
  workers: {type: 'string', default: String(Math.min(6, availableParallelism()))},
}});
const game = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const source = {
  commit: execFileSync('git', ['rev-parse', 'HEAD'], {cwd: game, encoding: 'utf8'}).trim(),
  node: process.version,
  simulationHz: 20,
  decisionHz: 10,
};
const workerLimit = Number(values.workers);
if (!Number.isInteger(workerLimit) || workerLimit < 1) throw new Error('Workers must be a positive integer');
const sessions = new Map();
const workers = [];
let nextWorld = 0;

function respond(response, status, result) {
  response.writeHead(status, {'content-type': 'application/json; charset=utf-8'});
  response.end(JSON.stringify(result));
}

function startWorker() {
  const child = spawn(process.execPath, ['--import', 'tsx', 'scripts/learning/simulation-worker.ts'], {
    cwd: game, stdio: ['pipe', 'pipe', 'pipe'],
  });
  const worker = {child, worlds: new Map(), stderr: ''};
  workers.push(worker);
  const lines = createInterface({input: child.stdout});
  lines.on('line', line => {
    const message = JSON.parse(line);
    const session = worker.worlds.get(message.world);
    const response = session?.pending;
    if (response) {
      session.pending = undefined;
      respond(response, 200, message.result);
    }
  });
  child.stderr.on('data', data => {worker.stderr = (worker.stderr + data).slice(-8192);});
  const fail = error => {
    for (const session of worker.worlds.values()) {
      if (session.pending) {
        respond(session.pending, 503, {type: 'error', error});
        session.pending = undefined;
      }
    }
  };
  child.on('error', error => fail(error.message));
  child.stdin.on('error', error => fail(error.message));
  child.on('exit', (code, signal) => {
    fail(`Simulation exited (${code ?? signal}): ${worker.stderr}`);
    lines.close();
    workers.splice(workers.indexOf(worker), 1);
  });
  return worker;
}

function startWorld(socket) {
  const worker = workers.length < workerLimit ? startWorker()
    : workers.reduce((first, second) => first.worlds.size <= second.worlds.size ? first : second);
  const session = {world: ++nextWorld, worker, pending: undefined};
  sessions.set(socket, session);
  worker.worlds.set(session.world, session);
  socket.once('close', () => {
    sessions.delete(socket);
    worker.worlds.delete(session.world);
    if (worker.child.exitCode === null && worker.child.signalCode === null && worker.child.stdin.writable) {
      worker.child.stdin.write(`${JSON.stringify({world: session.world, type: 'close'})}\n`);
    }
  });
  return session;
}

const server = createServer((request, response) => {
  if (request.method === 'GET' && request.url === '/health') {
    respond(response, 200, {status: 'ready', service: 'cdtank-learning', protocol: 1,
      source, processId: process.pid, worlds: sessions.size,
      workers: workers.length, workerLimit});
    return;
  }
  if (request.method !== 'POST' || request.url !== '/environment') {
    respond(response, 404, {type: 'error', error: 'Use GET /health or POST /environment'});
    return;
  }
  let body = '';
  request.setEncoding('utf8');
  request.on('data', data => {body += data;});
  request.on('end', () => {
    let command;
    try {
      command = JSON.parse(body);
      if (command.type !== 'reset' && command.type !== 'step') throw new Error('Use reset or step');
    } catch (error) {
      respond(response, 400, {type: 'error', error: error.message});
      return;
    }
    const session = sessions.get(request.socket) ?? startWorld(request.socket);
    const worker = session.worker;
    if (session.pending) {
      respond(response, 409, {type: 'error', error: 'Wait for the previous world command'});
      return;
    }
    if (worker.child.exitCode !== null || worker.child.signalCode !== null) {
      respond(response, 503, {type: 'error', error: `Simulation ended: ${worker.stderr}`});
      return;
    }
    session.pending = response;
    worker.child.stdin.write(`${JSON.stringify({...command, world: session.world})}\n`);
  });
});
server.keepAliveTimeout = 0;
server.requestTimeout = 0;
server.on('error', error => {console.error(error); process.exitCode = 1;});
server.listen(Number(values.port), values.host, () => {
  console.log(JSON.stringify({service: 'cdtank-learning', host: values.host,
    port: Number(values.port), processId: process.pid, source}));
});
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    for (const socket of sessions.keys()) socket.destroy();
    for (const worker of workers) worker.child.kill();
    server.close();
  });
}
