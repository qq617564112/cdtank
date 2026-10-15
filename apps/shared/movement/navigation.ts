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

// Rooms and planning copies share terrain bytes; each grid owns its occupancy.
const decodedLayers = new WeakMap<SourceNavigationLayer, WeakRef<DataView>>();

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
    let cells = decodedLayers.get(source)?.deref();
    if (!cells) {
      const bytes = Uint8Array.from(atob(source.cells), value => value.charCodeAt(0));
      cells = new DataView(bytes.buffer);
      decodedLayers.set(source, new WeakRef(cells));
    }
    this.cells = cells;
  }

  /** Planning copy with selected scene occupancy removed; the live grid stays intact. */
  withoutBlockers(ids: ReadonlySet<string>): NavigationGrid {
    const grid = new NavigationGrid(this.source);
    for (const [id, cells] of this.blockers) {
      if (!ids.has(id)) grid.setBlocker(id, cells);
    }
    return grid;
  }

  hasBlocker(id: string): boolean {return this.blockers.has(id);}

  /** Live render-model occupancy, separate from the original NAV fields. */
  isOccupiedCell(x: number, z: number): boolean {
    return x >= 0 && z >= 0 && x < this.source.width && z < this.source.height
      && this.occupied.has(z * this.source.width + x);
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

  /**
   * Project ground height interpolates the original valid cell centers.
   * Occupancy affects movement, not terrain height; callers check passage
   * separately. Invalid NAV heights do not contribute to the interpolation.
   */
  groundHeightAt(x: number, z: number): number | undefined {
    const column = Math.max(0, Math.min(this.source.width - 1,
      (x - this.source.minimum[0]) / 12 - 0.5));
    const row = Math.max(0, Math.min(this.source.height - 1,
      (z - this.source.minimum[2]) / 12 - 0.5));
    const left = Math.floor(column), top = Math.floor(row);
    const dx = column - left, dz = row - top;
    let height = 0, weight = 0;
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 2; c++) {
        const amount = (c === 0 ? 1 - dx : dx) * (r === 0 ? 1 - dz : dz);
        if (amount === 0) continue;
        const offset = (Math.min(top + r, this.source.height - 1) * this.source.width
          + Math.min(left + c, this.source.width - 1)) * 8;
        if ((this.cells.getUint32(offset + 4, true) & 255) <= 1) continue;
        height += this.cells.getFloat32(offset, true) * amount;
        weight += amount;
      }
    }
    return weight > 0 ? Math.fround(height / weight) : undefined;
  }

  /** World-coordinate validity query without allocating a height/fields result. */
  isValidAt(x: number, z: number): boolean {
    const column = Math.trunc((x - this.source.minimum[0]) * INVERSE_SIZE) || 0;
    const row = Math.trunc((z - this.source.minimum[2]) * INVERSE_SIZE) || 0;
    if (column < 0 || row < 0 || column >= this.source.width || row >= this.source.height) return false;
    const index = row * this.source.width + column;
    return (this.cells.getUint32(index * 8 + 4, true) & 255) > 1 && !this.occupied.has(index);
  }

  /** Stored cell height for an unblocked world position, without a cell result. */
  validHeightAt(x: number, z: number): number | undefined {
    const column = Math.trunc((x - this.source.minimum[0]) * INVERSE_SIZE) || 0;
    const row = Math.trunc((z - this.source.minimum[2]) * INVERSE_SIZE) || 0;
    if (column < 0 || row < 0 || column >= this.source.width || row >= this.source.height) return undefined;
    const index = row * this.source.width + column;
    if ((this.cells.getUint32(index * 8 + 4, true) & 255) <= 1 || this.occupied.has(index)) return undefined;
    return this.cells.getFloat32(index * 8, true);
  }

  positionAtCell(x: number, z: number): {x: number; y: number; z: number} | undefined {
    if (x < 0 || z < 0 || x >= this.source.width || z >= this.source.height) {
      return undefined;
    }
    const index = z * this.source.width + x, offset = index * 8;
    if ((this.cells.getUint32(offset + 4, true) & 255) <= 1 || this.occupied.has(index)) return undefined;
    // CDTank.exe 0x45788c writes f32 centers and uses the stored height.
    return {x: Math.fround(x * 12 + this.source.minimum[0] + 6), y: this.cells.getFloat32(offset, true),
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
