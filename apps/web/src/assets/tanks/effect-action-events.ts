export interface EffectActionEvent {
  readonly time: number;
  readonly name: string;
  readonly identifier: number;
}

/** Original gbActor::Update truncates each scaled delta; no fractional carry. */
export function effectActorTimeStep(deltaSeconds: number, timeScale: number,
  precision: 53 | 64): number {
  const scale = Math.fround(timeScale);
  if (precision === 53) return Math.trunc(deltaSeconds * scale * 4800);
  const sign = Math.sign(deltaSeconds) * Math.sign(scale);
  let [significand, exponent] = binaryParts(Math.abs(deltaSeconds));
  const [scaleSignificand, scaleExponent] = binaryParts(Math.abs(scale));
  significand *= scaleSignificand;
  exponent += scaleExponent;
  [significand, exponent] = roundExtended(significand, exponent);
  [significand, exponent] = roundExtended(significand * 4800n, exponent);
  const integer = exponent >= 0 ? significand << BigInt(exponent) :
    significand >> BigInt(-exponent);
  return sign * Number(integer);
}

function binaryParts(value: number): [bigint, number] {
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, value);
  const bits = view.getBigUint64(0);
  const exponent = Number((bits >> 52n) & 0x7ffn);
  const fraction = bits & ((1n << 52n) - 1n);
  return exponent === 0 ? [fraction, -1074] :
    [fraction | (1n << 52n), exponent - 1023 - 52];
}

function roundExtended(significand: bigint, exponent: number): [bigint, number] {
  const shift = significand.toString(2).length - 64;
  if (shift <= 0) return [significand, exponent];
  const remainder = significand & ((1n << BigInt(shift)) - 1n);
  let rounded = significand >> BigInt(shift);
  const halfway = 1n << BigInt(shift - 1);
  if (remainder > halfway || (remainder === halfway && (rounded & 1n) !== 0n)) {
    ++rounded;
  }
  return [rounded, exponent + shift];
}

/** Original 0x1000bdc0 query, including its leading loop-completion message. */
export function queryEffectActionEvents(duration: number, events: readonly EffectActionEvent[],
  previous: number, current: number): number[] {
  const beginning = previous % duration;
  const ending = (beginning + ((current - previous) >>> 0)) >>> 0;
  const messages: number[] = ending >= duration ? [0x6f766572] : [];
  if (events.length === 0) return messages;
  for (let loop = 0; loop * duration <= ending; ++loop) {
    for (const event of events) {
      const occurrence = loop * duration + event.time;
      if (occurrence > ending) return messages;
      if (occurrence > beginning) messages.push(event.identifier);
    }
  }
  return messages;
}
