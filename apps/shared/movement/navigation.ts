export interface SourceNavigationLayer {
  minimum: number[];
  maximum: number[];
  width: number;
  height: number;
  /** Original little-endian f32 height plus four field bytes per cell. */
  cells: string;
}

export interface NavigationCell {
  x: number;
  z: number;
  height: number;
  fields: number;
  valid: boolean;
}

// CDTank.exe 0x433f92 uses this f32 constant then truncates toward zero.
const INVERSE_SIZE = Math.fround(1 / 12);

export class NavigationGrid {
  private readonly cells: DataView;
  private readonly blockers = new Map<string, ReadonlySet<number>>();
  private readonly occupied = new Map<number, number>();

  /** Update per-room occupancy and report cells becoming blocked or free. */
  setBlocker(id: string, cells?: ReadonlySet<number>): boolean {
    const previous = this.blockers.get(id);
    let changed = false;
    for (const index of previous ?? []) {
      if (cells?.has(index)) continue;
      const remaining = this.occupied.get(index)! - 1;
      if (remaining) this.occupied.set(index, remaining);
      else {
        this.occupied.delete(index);
        changed = true;
      }
    }
    if (cells?.size) this.blockers.set(id, cells);
    else this.blockers.delete(id);
    for (const index of cells ?? []) {
      if (previous?.has(index)) continue;
      const occupied = this.occupied.get(index) ?? 0;
      this.occupied.set(index, occupied + 1);
      if (occupied === 0) changed = true;
    }
    return changed;
  }

  constructor(readonly source: SourceNavigationLayer) {
    const bytes = Uint8Array.from(atob(source.cells), value => value.charCodeAt(0));
    this.cells = new DataView(bytes.buffer);
  }

  cellAt(x: number, z: number): NavigationCell | undefined {
    if (x < 0 || z < 0 || x >= this.source.width || z >= this.source.height) {
      return undefined;
    }
    const offset = (z * this.source.width + x) * 8;
    const fields = this.cells.getUint32(offset + 4, true);
    return {x, z, height: this.cells.getFloat32(offset, true), fields,
      valid: (fields & 255) > 1 && !this.occupied.has(z * this.source.width + x)};
  }

  sample(x: number, z: number): NavigationCell | undefined {
    return this.cellAt(Math.trunc((x - this.source.minimum[0]) * INVERSE_SIZE) || 0,
      Math.trunc((z - this.source.minimum[2]) * INVERSE_SIZE) || 0);
  }

  positionAtCell(x: number, z: number): {x: number; y: number; z: number} | undefined {
    const cell = this.cellAt(x, z);
    if (!cell?.valid) {
      return undefined;
    }
    // CDTank.exe 0x45788c writes f32 centers and uses the stored height.
    return {x: Math.fround(x * 12 + this.source.minimum[0] + 6), y: cell.height,
      z: Math.fround(z * 12 + this.source.minimum[2] + 6)};
  }

  /** Sweep the center through every crossed cell, including short corner crossings. */
  firstInvalidFraction(start: {x: number; z: number}, end: {x: number; z: number}): number | undefined {
    if (!this.sample(start.x, start.z)?.valid) {
      return 0;
    }
    const crossings = [0, 1];
    for (const [axis, minimum, count] of [
      ['x', this.source.minimum[0], this.source.width],
      ['z', this.source.minimum[2], this.source.height],
    ] as const) {
      const a = (start[axis] - minimum) * INVERSE_SIZE;
      const b = (end[axis] - minimum) * INVERSE_SIZE;
      if (a === b) {
        continue;
      }
      const add = (boundary: number): void => {
        const fraction = (boundary - a) / (b - a);
        if (fraction > 0 && fraction < 1) {
          crossings.push(fraction);
        }
      };
      // Truncation maps (-1, 0) to cell zero. Zero is not a cell boundary.
      add(-1);
      for (let boundary = Math.max(1, Math.ceil(Math.min(a, b)));
        boundary <= Math.min(count, Math.floor(Math.max(a, b))); boundary++) {
        add(boundary);
      }
    }
    crossings.sort((a, b) => a - b);
    for (let index = 1; index < crossings.length; index++) {
      if (crossings[index] === crossings[index - 1]) {
        continue;
      }
      const fraction = (crossings[index - 1] + crossings[index]) / 2;
      if (!this.sample(start.x + (end.x - start.x) * fraction,
        start.z + (end.z - start.z) * fraction)?.valid) {
        return crossings[index - 1];
      }
    }
    return this.sample(end.x, end.z)?.valid ? undefined : 1;
  }
}
