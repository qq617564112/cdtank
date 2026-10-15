/** Published source records and vectors are immutable; instance state stays independent. */
export interface PackedEffectLibrary {
  vectors: number[][];
  vectorFields: Record<string, string[][]>;
  controlRecords: Record<string, Record<string, Record<string, unknown>[]>>;
  library: Record<string, unknown>;
}

function restoreVectorField(value: unknown, path: readonly string[], vectors: number[][],
  depth = 0): unknown {
  if (depth === path.length) return vectors[value as number];
  const field = path[depth];
  if (field === '*') {
    const items = value as unknown[];
    for (let index = 0; index < items.length; index++) {
      items[index] = restoreVectorField(items[index], path, vectors, depth + 1);
    }
  } else {
    const record = value as Record<string, unknown>;
    if (record[field] !== undefined) {
      record[field] = restoreVectorField(record[field], path, vectors, depth + 1);
    }
  }
  return value;
}

/** Restore each shared record before installing it into the original control fields. */
export function unpackEffectLibrary(packed: PackedEffectLibrary): unknown {
  for (const table of Object.keys(packed.vectorFields)) {
    const rows = packed.library[table] as unknown[];
    for (const path of packed.vectorFields[table]) {
      const shared = packed.controlRecords[table]?.[path[0]];
      for (const row of shared ?? rows) {
        restoreVectorField(row, path, packed.vectors, shared ? 1 : 0);
      }
    }
  }
  for (const table of Object.keys(packed.controlRecords)) {
    const rows = packed.library[table] as Record<string, unknown>[];
    for (const [field, records] of Object.entries(packed.controlRecords[table])) {
      for (const row of rows) {
        if (row[field] !== undefined) row[field] = records[row[field] as number];
      }
    }
  }
  return packed.library;
}
