import {loadStaticBinary} from '../static-resources';
import {TANK_TAG_FRAME_SIZE, type TankComponentDefinition, type TankComponentAction,
  type TankTagRange, type TankTagTrack} from './tank-action-format';

interface SharedTankAction {
  references: number;
  loading: Promise<TankComponentAction[]>;
}
interface BorrowedAction {
  key: string;
  shared: SharedTankAction;
  loading: Promise<TankComponentAction[]>;
}
export interface TankActionResources {
  load(name: string): Promise<TankComponentAction[]>;
  release(name?: string): void;
}

const actions = new Map<string, SharedTankAction>();

function releaseAction(borrowed: BorrowedAction): void {
  if (--borrowed.shared.references === 0 && actions.get(borrowed.key) === borrowed.shared) {
    actions.delete(borrowed.key);
  }
}

async function loadAction(tankId: number, components: readonly TankComponentDefinition[],
  name: string): Promise<TankComponentAction[]> {
  const definitions = components.filter(component => component.actions.length > 0).map(component => {
    const action = component.actions.find(action => action.fields.name === name);
    if (!action) throw new Error(`战车 ${tankId} 缺少 ${component.part}/${name}`);
    return {part: component.part, action};
  });
  if (!definitions.length) return [];
  const binary = await loadStaticBinary(definitions[0].action.trackFile);
  const track = (range: TankTagRange): TankTagTrack => ({length: range.length,
    data: new Float32Array(binary, range.offset * 4, range.length * TANK_TAG_FRAME_SIZE)});
  return definitions.map(({part, action}) => ({part, action: {...action,
    primaryTags: action.primaryTags.map(tag => ({...tag, frames: track(tag.frames)})),
    turretPivotFrames: action.turretPivotFrames ? track(action.turretPivotFrames) : null,
  }}));
}

/** Same tank/action borrows one decoded buffer until the last viewport or player leaves. */
export function retainTankActionResources(tankId: number,
  components: readonly TankComponentDefinition[]): TankActionResources {
  const borrowed = new Map<string, BorrowedAction>();
  let released = false;
  return {
    load(name) {
      if (released) return Promise.reject(new Error('战车动作数据已释放'));
      const cached = borrowed.get(name);
      if (cached) return cached.loading;
      const key = `${tankId}/${name}`;
      let shared = actions.get(key);
      if (!shared) {
        shared = {references: 0, loading: loadAction(tankId, components, name)};
        actions.set(key, shared);
      }
      shared.references++;
      const entry: BorrowedAction = {key, shared, loading: shared.loading};
      entry.loading = shared.loading.catch(error => {
        if (borrowed.get(name) === entry) {
          borrowed.delete(name);
          releaseAction(entry);
        }
        throw error;
      });
      borrowed.set(name, entry);
      return entry.loading;
    },
    release(name?: string) {
      if (released) return;
      if (name !== undefined) {
        const entry = borrowed.get(name);
        if (!entry) return;
        borrowed.delete(name);
        releaseAction(entry);
        return;
      }
      released = true;
      for (const entry of borrowed.values()) releaseAction(entry);
      borrowed.clear();
    },
  };
}
