// Raw-memory kernels used exclusively by the offline asset publisher.
@external('env', 'hypot')
declare function hypot(x: f64, y: f64, z: f64): f64;

function quantize(value: f32): f64 {return Math.floor(<f64>value * 10000 + 0.5);}

/** Group coincident positions, preserving source order and double-precision sums. */
export function outlineNormals(positions: usize, normals: usize, count: i32, output: usize,
  groups: usize, sums: usize, slots: usize, slotCount: i32): void {
  memory.fill(slots, 0, <usize>slotCount * 4);
  memory.fill(sums, 0, <usize>count * 24);
  for (let vertex = 0; vertex < count; vertex++) {
    const offset = <usize>vertex * 12;
    const x = quantize(load<f32>(positions + offset));
    const y = quantize(load<f32>(positions + offset + 4));
    const z = quantize(load<f32>(positions + offset + 8));
    let slot = ((<u32><i64>x * 73856093) ^ (<u32><i64>y * 19349663)
      ^ (<u32><i64>z * 83492791)) & <u32>(slotCount - 1);
    let group = vertex;
    while (true) {
      const entry = load<u32>(slots + <usize>slot * 4);
      if (entry == 0) {store<u32>(slots + <usize>slot * 4, <u32>vertex + 1); break;}
      const candidate = <usize>(entry - 1) * 12;
      if (quantize(load<f32>(positions + candidate)) == x
        && quantize(load<f32>(positions + candidate + 4)) == y
        && quantize(load<f32>(positions + candidate + 8)) == z) {group = <i32>entry - 1; break;}
      slot = (slot + 1) & <u32>(slotCount - 1);
    }
    store<i32>(groups + <usize>vertex * 4, group);
    for (let axis: usize = 0; axis < 3; axis++) {
      const target = sums + <usize>group * 24 + axis * 8;
      store<f64>(target, load<f64>(target) + load<f32>(normals + offset + axis * 4));
    }
  }
  for (let vertex = 0; vertex < count; vertex++) {
    const group = sums + <usize>load<i32>(groups + <usize>vertex * 4) * 24;
    const x = load<f64>(group), y = load<f64>(group + 8), z = load<f64>(group + 16);
    const length = hypot(x, y, z);
    store<f32>(output + <usize>vertex * 12, length == 0 ? 0 : <f32>(x / length));
    store<f32>(output + <usize>vertex * 12 + 4, length == 0 ? 0 : <f32>(y / length));
    store<f32>(output + <usize>vertex * 12 + 8, length == 0 ? 0 : <f32>(z / length));
  }
}

/** Exact word comparisons resolve hash collisions; output keeps first occurrences. */
export function deduplicateFrames(input: usize, frames: i32, words: i32, mapping: usize,
  unique: usize, slots: usize, slotCount: i32): i32 {
  memory.fill(slots, 0, <usize>slotCount * 4);
  let count = 0;
  for (let frame = 0; frame < frames; frame++) {
    const source = input + <usize>frame * <usize>words * 4;
    let hash: u32 = 2166136261;
    for (let word = 0; word < words; word++) hash = (hash ^ load<u32>(source + <usize>word * 4)) * 16777619;
    let slot = hash & <u32>(slotCount - 1);
    let layer = count;
    while (true) {
      const entry = load<u32>(slots + <usize>slot * 4);
      if (entry == 0) {
        store<u32>(slots + <usize>slot * 4, <u32>count + 1);
        store<i32>(unique + <usize>count * 4, frame);
        count++;
        break;
      }
      const candidate = input + <usize>load<i32>(unique + <usize>(entry - 1) * 4) * <usize>words * 4;
      let equal = true;
      for (let word = 0; word < words; word++) {
        if (load<u32>(source + <usize>word * 4) != load<u32>(candidate + <usize>word * 4)) {equal = false; break;}
      }
      if (equal) {layer = <i32>entry - 1; break;}
      slot = (slot + 1) & <u32>(slotCount - 1);
    }
    store<i32>(mapping + <usize>frame * 4, layer);
  }
  return count;
}

/** Match glTF's float32 delta + base reconstruction before comparing poses. */
export function absolutePose(base: usize, delta: usize, output: usize, words: i32): void {
  for (let word = 0; word < words; word++) {
    const offset = <usize>word * 4;
    store<f32>(output + offset, load<f32>(base + offset) + load<f32>(delta + offset));
  }
}

export function isPlanar(positions: usize, normals: usize, count: i32): bool {
  const x = <f64>load<f32>(normals), y = <f64>load<f32>(normals + 4), z = <f64>load<f32>(normals + 8);
  const distance = load<f32>(positions) * x + load<f32>(positions + 4) * y + load<f32>(positions + 8) * z;
  for (let vertex = 1; vertex < count; vertex++) {
    const offset = <usize>vertex * 12;
    if (Math.abs(load<f32>(positions + offset) * x + load<f32>(positions + offset + 4) * y
      + load<f32>(positions + offset + 8) * z - distance) > 0.001) return false;
  }
  return true;
}

/** Split first-frame geometry, full-animation bounds and unique GPU texture layers. */
export function packCvd(input: usize, count: i32, frameCount: i32, unique: usize, uniqueCount: i32,
  positions: usize, uvs: usize, bounds: usize, pixels: usize, vs: usize, ids: usize): void {
  for (let axis: usize = 0; axis < 3; axis++) {
    store<f32>(bounds + axis * 4, Infinity);
    store<f32>(bounds + 12 + axis * 4, -Infinity);
  }
  for (let frame = 0; frame < frameCount; frame++) {
    for (let vertex = 0; vertex < count; vertex++) {
      const source = input + (<usize>frame * <usize>count + <usize>vertex) * 20;
      for (let axis: usize = 0; axis < 3; axis++) {
        const value = load<f32>(source + axis * 4) * (axis == 0 ? -1 : 1);
        store<f32>(bounds + axis * 4, Mathf.min(load<f32>(bounds + axis * 4), value));
        store<f32>(bounds + 12 + axis * 4, Mathf.max(load<f32>(bounds + 12 + axis * 4), value));
        if (frame == 0) store<f32>(positions + <usize>vertex * 12 + axis * 4, value);
      }
      if (frame == 0) {
        store<f32>(uvs + <usize>vertex * 8, load<f32>(source + 12));
        store<f32>(uvs + <usize>vertex * 8 + 4, load<f32>(source + 16));
      }
    }
  }
  if (uniqueCount < 2) return;
  for (let frame = 0; frame < uniqueCount; frame++) {
    const sourceFrame = load<i32>(unique + <usize>frame * 4);
    for (let vertex = 0; vertex < count; vertex++) {
      const source = input + (<usize>sourceFrame * <usize>count + <usize>vertex) * 20;
      const target = <usize>(frame * count + vertex);
      memory.copy(pixels + target * 16, source, 16);
      store<f32>(vs + target * 4, load<f32>(source + 16));
    }
  }
  for (let vertex = 0; vertex < count; vertex++) store<f32>(ids + <usize>vertex * 4, <f32>vertex);
}
