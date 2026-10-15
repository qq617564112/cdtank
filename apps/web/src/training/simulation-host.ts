import type {RoomPassword, SimulationCatalog, SimulationMap} from '../../../shared/simulation/resources';

let catalog: SimulationCatalog | undefined;
let catalogLoading: Promise<SimulationCatalog> | undefined;
const assets = new Map<string, unknown>([['battlefields.json', []]]);

async function readJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`训练数据载入失败：${url} (${response.status})`);
  return response.json() as Promise<T>;
}

export async function loadTrainingCatalog(): Promise<SimulationCatalog> {
  if (catalog) return catalog;
  return catalogLoading ??= readJson<SimulationCatalog>('/content/training/catalog.json').then(value => {
    catalog = value;
    assets.set('scene-placements.json', value.scenes);
    return value;
  }).catch(error => {catalogLoading = undefined; throw error;});
}

export async function loadTrainingMap(mapId: number): Promise<void> {
  await loadTrainingCatalog();
  const id = String(mapId).padStart(4, '0');
  if (assets.has(`scene-collision/${id}.json`)) return;
  const map = await readJson<SimulationMap>(`/content/training/maps/${id}.json`);
  if (Number(map.field.id) !== mapId) throw new Error('训练地图数据不匹配');
  (assets.get('battlefields.json') as SimulationMap['field'][]).push(map.field);
  assets.set(`scene-collision/${id}.json`, map.collision);
}

export function readSimulationAsset<T>(name: string): T {
  if (!assets.has(name)) throw new Error(`训练地图数据未载入：${name}`);
  return assets.get(name) as T;
}

export function readSimulationTable<T>(name: string): T {
  if (!catalog || !(name in catalog.tables)) throw new Error(`训练表未载入：${name}`);
  return catalog.tables[name] as T;
}

export function readSimulationContent<T>(name: string): T {
  if (!catalog || !(name in catalog.content)) throw new Error(`训练配置未载入：${name}`);
  return catalog.content[name] as T;
}

export function createRoomPassword(password: string): RoomPassword {
  if (password) throw new Error('训练模式不设置房间密码');
  return {};
}

export function matchesRoomPassword(): boolean {return true;}

let nextItemId = 0;
export function simulationItemId(): string {return `training-${++nextItemId}`;}
