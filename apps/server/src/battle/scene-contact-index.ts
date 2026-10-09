import type {RoleObb} from './roles/obb-intersection';

const CELL_SIZE = 128;

/** Static contacts in room order; hidden/enabled state is read by the caller. */
export class SceneContactIndex<Entry extends {obb: RoleObb}> {
  private readonly cells = new Map<string, number[]>();

  constructor(private readonly entries: readonly Entry[]) {
    entries.forEach(({obb}, index) => {
      // Six-face-axis IsColOBB can accept contacts beyond geometric AABBs.
      // Bound each source's projection onto any horizontal role axis instead.
      let projection = 0;
      for (let axis = 0; axis < 3; axis++) {
        projection += Math.hypot(Math.fround(obb.matrix[axis * 4]),
          Math.fround(obb.matrix[axis * 4 + 2])) * Math.fround(obb.dimensions[axis]) / 2;
      }
      // The two horizontal role constraints bound distance by sqrt(2) times
      // this projection plus the role's half diagonal. Round out for f32 SAT.
      const radius = Math.ceil(Math.SQRT2 * projection) + 1;
      const x = Math.fround(obb.matrix[12]), z = Math.fround(obb.matrix[14]);
      const minX = Math.floor((x - radius) / CELL_SIZE), maxX = Math.floor((x + radius) / CELL_SIZE);
      const minZ = Math.floor((z - radius) / CELL_SIZE), maxZ = Math.floor((z + radius) / CELL_SIZE);
      for (let cx = minX; cx <= maxX; cx++) {
        for (let cz = minZ; cz <= maxZ; cz++) {
          const key = `${cx},${cz}`;
          let contacts = this.cells.get(key);
          if (!contacts) {contacts = []; this.cells.set(key, contacts);}
          contacts.push(index);
        }
      }
    });
  }

  /** Query the actual current or predicted horizontal tank OBB. */
  nearby(role: RoleObb): Entry[] {
    const norm = Math.hypot(Math.fround(role.matrix[0]), Math.fround(role.matrix[2]));
    const radius = Math.ceil(Math.hypot(Math.fround(role.dimensions[0]),
      Math.fround(role.dimensions[2])) / (2 * norm)) + 1;
    const x = Math.fround(role.matrix[12]), z = Math.fround(role.matrix[14]);
    const minX = Math.floor((x - radius) / CELL_SIZE), maxX = Math.floor((x + radius) / CELL_SIZE);
    const minZ = Math.floor((z - radius) / CELL_SIZE), maxZ = Math.floor((z + radius) / CELL_SIZE);
    const candidates = new Set<number>();
    for (let cx = minX; cx <= maxX; cx++) {
      for (let cz = minZ; cz <= maxZ; cz++) {
        for (const index of this.cells.get(`${cx},${cz}`) ?? []) candidates.add(index);
      }
    }
    return [...candidates].sort((a, b) => a - b).map(index => this.entries[index]);
  }
}
