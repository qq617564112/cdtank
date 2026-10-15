import {readFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import type {Plugin} from 'vite';
import type {ContentIndex, TankDefinition} from '../shared/content/types';
import type {MapOption} from '../shared/protocols';
import type {SimulationCatalog} from '../shared/simulation/resources';

interface SourceTable {rows: {values: Record<string, string>}[];}
interface SceneMap {id: string; records: {className: string}[]; castles: {className: string}[];}

/** Select the browser host while retaining the same battle and AI implementation. */
export function trainingHostPlugin(workspace: string): Plugin {
  const serverHost = resolve(workspace, 'apps/server/src/runtime/simulation-host');
  return {name: 'training-simulation-host', enforce: 'pre',
    resolveId(source, importer) {
      if (importer && source.startsWith('.')
          && resolve(dirname(importer.split('?')[0]), source).replace(/\.ts$/, '') === serverHost) {
        return resolve(workspace, 'apps/web/src/training/simulation-host.ts');
      }
    },
  };
}

/** Publish static simulation inputs; these endpoints never create a server room. */
export function trainingDataPlugin(workspace: string): Plugin {
  const contentRoot = resolve(workspace, 'apps/shared/content/definitions');
  const assetsRoot = resolve(workspace, 'apps/server/resources/assets');
  const tablesRoot = resolve(workspace, 'apps/server/resources/tables');
  const read = <T>(path: string): T => JSON.parse(readFileSync(path, 'utf8')) as T;
  const readTable = (name: string): SourceTable => read(resolve(tablesRoot, `${name}.json`));
  const mapDirectory = (): MapOption[] => {
    const maps = readTable('m004').rows.map(({values}) => ({mode: 6, mapId: Number(values.MapID),
      name: values.MapName, timeLimit: Number(values.Time), sourceMinPlayers: 1, maxPlayers: Number(values.PlayerMax)}));
    const strings = readTable('gamestring').rows;
    for (const scene of read<SceneMap[]>(resolve(assetsRoot, 'scene-placements.json'))) {
      const mapId = Number(scene.id);
      if (mapId < 1 || mapId > 25 || maps.some(map => map.mapId === mapId)) continue;
      const name = strings.find(({values}) => Number(values.ID) === 629 + mapId)!.values.String
        .replace(/^使用地图：/, '');
      maps.push({...maps[0], mapId, name, maxPlayers: 12});
    }
    return maps;
  };
  const catalog = (): SimulationCatalog => {
    const index = read<ContentIndex>(resolve(contentRoot, 'index.json'));
    const paths = ['index.json', ...index.tanks, ...index.pets, ...index.items, ...index.skills];
    const content = Object.fromEntries(paths.map(path => [path, read(resolve(contentRoot, path))]));
    // Attachment animation tracks belong to presentation, outside the simulation worker.
    for (const path of index.tanks) {
      const tank = content[path] as TankDefinition;
      for (const component of tank.resources.components) {
        component.actions = component.actions.map(action => {
          const {primaryTags, turretPivotFrames, ...simulationAction} = action as Record<string, unknown>;
          return simulationAction;
        });
      }
    }
    const tables = Object.fromEntries(['m001', 'm002', 'm003', 'm004', 'm005', 'title', 'gamestring', 'dropitem']
      .map(name => [name, readTable(name)]));
    for (const row of tables.m004.rows) row.values.PlayerMin = '1';
    const scenes = read<SceneMap[]>(resolve(assetsRoot, 'scene-placements.json'));
    return {content, tables, maps: mapDirectory(),
      scenes: scenes.map(scene => ({id: scene.id, records: scene.records.map(({className}) => ({className})),
        castles: scene.castles.map(({className}) => ({className}))}))};
  };
  let fields: {id: string}[] | undefined;
  const mapData = (id: string): string => {
    fields ??= read<{id: string}[]>(resolve(assetsRoot, 'battlefields.json'));
    const field = fields.find(value => value.id === id);
    if (!field) throw new Error(`缺少训练地图：${id}`);
    return JSON.stringify({field, collision: read(resolve(assetsRoot, `scene-collision/${id}.json`))});
  };
  return {name: 'training-simulation-data',
    configureServer(server) {
      server.middlewares.use('/content/training', (request, response, next) => {
        const path = new URL(request.url ?? '/', 'http://localhost').pathname;
        try {
          const match = /^\/maps\/(\d{4})\.json$/.exec(path);
          const body = path === '/maps.json' ? JSON.stringify(mapDirectory())
            : path === '/catalog.json' ? JSON.stringify(catalog()) : match ? mapData(match[1]) : undefined;
          if (!body) return next();
          response.setHeader('Content-Type', 'application/json; charset=utf-8');
          response.setHeader('Cache-Control', 'no-cache');
          response.end(body);
        } catch (error) {next(error);}
      });
    },
    generateBundle() {
      const data = catalog();
      this.emitFile({type: 'asset', fileName: 'content/training/maps.json', source: JSON.stringify(data.maps)});
      this.emitFile({type: 'asset', fileName: 'content/training/catalog.json', source: JSON.stringify(data)});
      for (const map of data.maps) {
        const id = String(map.mapId).padStart(4, '0');
        this.emitFile({type: 'asset', fileName: `content/training/maps/${id}.json`, source: mapData(id)});
      }
    },
  };
}
