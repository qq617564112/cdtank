import {LEARNING_ACTION_SIZES} from './observation';

export interface SerializedActorPolicy {
  format: 'cdtank-recurrent-actor-v1';
  observationWidth: number;
  observationSchema: number;
  hiddenSize: number;
  actionSizes: number[];
  decisionMs: number;
  tensors: Record<string, number[] | number[][]>;
  checkpoint: {steps: number; source: unknown; simulationSource: unknown};
}

/** CPU execution of the trained encoder and PyTorch GRUCell, without a critic. */
export class RecurrentActor {
  readonly width: number;
  private readonly weights: Record<string, Float32Array> = {};

  constructor(readonly model: SerializedActorPolicy) {
    if (model.format !== 'cdtank-recurrent-actor-v1' || ![64, 128, 256].includes(model.hiddenSize)
        || model.decisionMs !== 100 || model.observationSchema !== 6 || model.observationWidth !== 305
        || model.actionSizes.join() !== LEARNING_ACTION_SIZES.join()) {
      throw new Error('Unsupported learned actor format');
    }
    this.width = model.observationWidth;
    const size = model.hiddenSize;
    const dimensions: Record<string, number> = {'encoder.weight': size * this.width, 'encoder.bias': size,
      'mask_encoder.weight': size * 20, 'memory.weight_ih': 3 * size * size, 'memory.weight_hh': 3 * size * size,
      'memory.bias_ih': 3 * size, 'memory.bias_hh': 3 * size, 'actor.weight': 20 * size, 'actor.bias': 20};
    for (const [name, size] of Object.entries(dimensions)) {
      const values = model.tensors[name]?.flat();
      if (!values || values.length !== size || values.some(value => !Number.isFinite(value))) {
        throw new Error(`Invalid learned tensor: ${name}`);
      }
      this.weights[name] = Float32Array.from(values);
    }
  }

  private linear(input: ArrayLike<number>, name: string, rows: number, bias = true): Float32Array {
    const result = new Float32Array(rows);
    const weight = this.weights[`${name}.weight`];
    const offset = this.weights[`${name}.bias`];
    for (let row = 0; row < rows; row++) {
      let value = bias ? offset[row] : 0;
      for (let column = 0; column < input.length; column++) value += weight[row * input.length + column] * input[column];
      result[row] = value;
    }
    return result;
  }

  decide(observation: readonly number[], masks: readonly (readonly boolean[])[], hidden: Float32Array) {
    const size = this.model.hiddenSize;
    if (observation.length !== this.width || hidden.length !== size) throw new Error('Learned input dimensions differ');
    const features = this.linear(observation, 'encoder', size);
    const mask = masks.flat().map(Number);
    const qualification = this.linear(mask, 'mask_encoder', size, false);
    for (let index = 0; index < size; index++) features[index] = Math.tanh(features[index] + qualification[index]);
    const gates = (name: string, input: Float32Array) => {
      const output = new Float32Array(3 * size);
      const weights = this.weights[`memory.weight_${name}`];
      const biases = this.weights[`memory.bias_${name}`];
      for (let row = 0; row < 3 * size; row++) {
        let value = biases[row];
        for (let column = 0; column < size; column++) value += weights[row * size + column] * input[column];
        output[row] = value;
      }
      return output;
    };
    const inputGates = gates('ih', features), hiddenGates = gates('hh', hidden);
    const next = new Float32Array(size);
    const sigmoid = (value: number) => 1 / (1 + Math.exp(-value));
    for (let index = 0; index < size; index++) {
      const reset = sigmoid(inputGates[index] + hiddenGates[index]);
      const update = sigmoid(inputGates[size + index] + hiddenGates[size + index]);
      const candidate = Math.tanh(inputGates[2 * size + index] + reset * hiddenGates[2 * size + index]);
      next[index] = (1 - update) * candidate + update * hidden[index];
    }
    const logits = this.linear(next, 'actor', 20);
    let offset = 0;
    const actions = LEARNING_ACTION_SIZES.map((size, head) => {
      let best = -1;
      for (let index = 0; index < size; index++) {
        if (masks[head][index] && (best < 0 || logits[offset + index] > logits[offset + best])) best = index;
      }
      if (best < 0) throw new Error('Learned action head has no qualified action');
      offset += size;
      return best;
    });
    return {actions, hidden: next, logits};
  }
}
