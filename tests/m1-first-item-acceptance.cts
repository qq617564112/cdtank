import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {join} from 'node:path';

interface InventoryEvidence {
  records: {ownedQuantity: number}[];
  hotkeys: number[];
}

interface WorldEvidence {
  status: string;
  lifecycle: {
    firstResult: {round: number};
    secondResult: {round: number};
    reentryInventory: InventoryEvidence;
    deaths: number;
    respawns: number;
  };
}

interface NetworkEvidence {
  status: string;
  staleSequenceNoExtraUse: boolean;
  fullHealthRefused: {type: string; message: string; playerId: string};
  pairedTick: number;
  inventory: InventoryEvidence;
  persisted: InventoryEvidence;
}

interface CpuEvidence {
  status: string;
  used: unknown[];
  secondRoundHits: number;
}

const root = process.cwd();
const cases = [
  {name: 'world', script: 'tests/healing-item-world.cts', output: 'recovery/output/healing-item-world.json'},
  {name: 'cpu', script: 'tests/cpu-healing-item.cts', output: 'recovery/output/cpu-healing-item.json'},
  {name: 'network', script: 'tests/healing-item-network.cts', output: 'recovery/output/healing-item-network.json'},
] as const;

const runs: {name: string; command: string; stdout: string}[] = [];
const evidence: Partial<{world: WorldEvidence; network: NetworkEvidence; cpu: CpuEvidence}> = {};
for (const test of cases) {
  const command = `${process.execPath} --import tsx ${test.script}`;
  const result = spawnSync(process.execPath, ['--import', 'tsx', test.script], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const stdout = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  runs.push({name: test.name, command, stdout: stdout.trim()});
  assert.equal(result.status, 0, `${test.name} failed:\n${stdout}`);
  assert.match(stdout, /PASS:/, `${test.name} did not report PASS`);
  const record = JSON.parse(readFileSync(join(root, test.output), 'utf8')) as {status: string};
  assert.equal(record.status, 'PASS', `${test.name} evidence is not PASS`);
  if (test.name === 'world') evidence.world = record as WorldEvidence;
  if (test.name === 'network') evidence.network = record as NetworkEvidence;
  if (test.name === 'cpu') evidence.cpu = record as CpuEvidence;
}

const world = evidence.world;
const network = evidence.network;
const cpu = evidence.cpu;
assert(world && network && cpu);
assert.equal(world.lifecycle.firstResult.round, 1);
assert.equal(world.lifecycle.secondResult.round, 2);
assert.equal(world.lifecycle.reentryInventory.records[0].ownedQuantity, 2);
assert.equal(network.staleSequenceNoExtraUse, true);
assert.equal(network.persisted.records[0].ownedQuantity, 2);
assert.equal(network.persisted.hotkeys[3], 77);
assert(cpu.used.length > 0);
assert(cpu.secondRoundHits > 0);

const output = {
  status: 'PASS',
  acceptance: 'M1 first-item feed closed loop',
  commands: cases.map(test => test.script),
  checks: {
    success: 'world success event restores HP and decrements owned/battle quantity',
    rejection: 'full-health, storage/CAS and stale-sequence requests are rejected without extra consumption',
    twoRounds: 'natural round 1 and round 2 settle; rematch retains remaining stock',
    accountRestart: 'network server restart restores quantity and hotkey while observer account remains isolated',
    cpu: 'unmodified CPU heals after natural injury and cannot replenish exhausted stock in round 2',
  },
  runs,
  evidence: {
    world: {rounds: [world.lifecycle.firstResult, world.lifecycle.secondResult], reentryInventory: world.lifecycle.reentryInventory,
      deaths: world.lifecycle.deaths, respawns: world.lifecycle.respawns},
    network: {fullHealthRefused: network.fullHealthRefused, pairedTick: network.pairedTick,
      staleSequenceNoExtraUse: network.staleSequenceNoExtraUse, inventory: network.inventory, persisted: network.persisted},
    cpu: {uses: cpu.used.length, secondRoundHits: cpu.secondRoundHits},
  },
};
writeFileSync(join(root, 'recovery/output/m1-first-item-acceptance.json'), `${JSON.stringify(output, null, 2)}\n`);
console.log('PASS: M1 first-item feed success/rejection, two natural rounds, CPU behavior and account restart recovery');
