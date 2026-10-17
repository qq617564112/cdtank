import {createInterface} from 'node:readline';
import {createLearningEnvironment, type ResetRequest, type StepRequest} from './environment';

const worlds = new Map<number, ReturnType<typeof createLearningEnvironment>>();
const lines = createInterface({input: process.stdin, crlfDelay: Infinity});
lines.on('line', line => {
  const request = JSON.parse(line) as {world: number} & (ResetRequest | StepRequest | {type: 'close'});
  if (request.type === 'close') {worlds.delete(request.world); return;}
  try {
    let environment = worlds.get(request.world);
    if (!environment) {
      environment = createLearningEnvironment(`LEARNING-${request.world}`);
      worlds.set(request.world, environment);
    }
    const result = environment.command(request);
    process.stdout.write(`${JSON.stringify({world: request.world, result})}\n`);
  } catch (error) {
    process.stdout.write(`${JSON.stringify({world: request.world,
      result: {type: 'error', error: error instanceof Error ? error.stack : String(error)}})}\n`);
  }
});
