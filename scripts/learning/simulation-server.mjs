import {spawn, execFileSync} from 'node:child_process';
import {createServer} from 'node:http';
import {dirname, resolve} from 'node:path';
import {createInterface} from 'node:readline';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';

const {values} = parseArgs({options: {
  host: {type: 'string', default: '0.0.0.0'},
  port: {type: 'string', default: '40101'},
}});
const game = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const source = {
  commit: execFileSync('git', ['rev-parse', 'HEAD'], {cwd: game, encoding: 'utf8'}).trim(),
  node: process.version,
  simulationHz: 20,
  decisionHz: 10,
};
const workers = new Map();

function respond(response, status, result) {
  response.writeHead(status, {'content-type': 'application/json; charset=utf-8'});
  response.end(JSON.stringify(result));
}

function startWorld(socket) {
  const child = spawn(process.execPath, ['--import', 'tsx', 'scripts/learning/environment.ts'], {
    cwd: game, stdio: ['pipe', 'pipe', 'pipe'],
  });
  const worker = {child, pending: undefined, stderr: ''};
  workers.set(socket, worker);
  const lines = createInterface({input: child.stdout});
  lines.on('line', line => {
    const response = worker.pending;
    worker.pending = undefined;
    if (response) {
      response.writeHead(200, {'content-type': 'application/json; charset=utf-8'});
      response.end(line);
    }
  });
  child.stderr.on('data', data => {worker.stderr = (worker.stderr + data).slice(-8192);});
  const fail = error => {
    if (worker.pending) {
      respond(worker.pending, 503, {type: 'error', error});
      worker.pending = undefined;
    }
  };
  child.on('error', error => fail(error.message));
  child.stdin.on('error', error => fail(error.message));
  child.on('exit', (code, signal) => {
    fail(`Simulation exited (${code ?? signal}): ${worker.stderr}`);
    lines.close();
  });
  socket.once('close', () => {
    workers.delete(socket);
    child.kill();
    lines.close();
  });
  return worker;
}

const server = createServer((request, response) => {
  if (request.method === 'GET' && request.url === '/health') {
    respond(response, 200, {status: 'ready', service: 'cdtank-learning', protocol: 1,
      source, processId: process.pid, worlds: workers.size});
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
    const worker = workers.get(request.socket) ?? startWorld(request.socket);
    if (worker.pending) {
      respond(response, 409, {type: 'error', error: 'Wait for the previous world command'});
      return;
    }
    if (worker.child.exitCode !== null || worker.child.signalCode !== null) {
      respond(response, 503, {type: 'error', error: `Simulation ended: ${worker.stderr}`});
      return;
    }
    worker.pending = response;
    worker.child.stdin.write(`${JSON.stringify(command)}\n`);
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
    for (const socket of workers.keys()) socket.destroy();
    server.close();
  });
}
