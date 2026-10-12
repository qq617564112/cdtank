interface SceneBreachLibrary {
  library: string;
  models: readonly string[];
}

/** Existing map libraries retain their source model and publication identity. */
const mapLibraries: Readonly<Record<string, readonly SceneBreachLibrary[]>> = {
  '0002': [
    {library: '/data/maps/0002/breach-05427.json', models: ['obj05427']},
    {library: '/data/maps/0021/breach.json', models: ['obj05422']},
    {library: '/data/maps/0014/breach.json', models: ['obj05425', 'obj05426', 'obj05428']},
  ],
  '0004': [
    {library: '/data/maps/0004/breach.json', models: ['obj05466']},
    {library: '/data/maps/0021/breach.json', models: ['obj05422']},
  ],
  '0005': [{library: '/data/maps/0005/breach.json', models: ['obj05425', 'obj05426', 'obj05432']}],
  '0006': [{library: '/data/maps/0006/breach.json', models: ['obj05421', 'obj05423', 'obj05443', 'obj05433', 'obj05432']}],
  '0007': [{library: '/data/maps/0007/breach.json', models: ['obj05466', 'obj05467', 'obj05468', 'obj05462', 'obj05423', 'obj05445']}],
  '0010': [{library: '/data/maps/0010/breach.json', models: ['obj05425', 'obj05426', 'obj05427', 'obj05428', 'obj05429']}],
  '0011': [{library: '/data/maps/0011/breach.json', models: ['obj05430']}],
  '0014': [{library: '/data/maps/0014/breach.json', models: ['obj05425', 'obj05426', 'obj05428']}],
  '0017': [{library: '/data/maps/0017/breach.json', models: ['obj05469']}],
  '0018': [{library: '/data/maps/0018/breach.json', models: ['obj05424', 'obj05442']}],
  '0020': [{library: '/data/maps/0020/breach.json', models: ['obj05460', 'obj05461', 'obj05462', 'obj05442', 'obj05434', 'obj05435', 'obj05436']}],
  '0021': [{library: '/data/maps/0021/breach.json', models: ['obj05422', 'obj05466', 'obj05467', 'obj05468']}],
  '0022': [{library: '/data/maps/0022/breach.json', models: ['obj05424', 'obj05469']}],
};

/** The same model uses its own c9 when placed on another original map. */
const modelLibraries: Readonly<Record<string, string>> = {
  obj05421: '/data/maps/0006/breach.json',
  obj05422: '/data/maps/0021/breach.json',
  obj05423: '/data/maps/0006/breach.json',
  obj05424: '/data/maps/0018/breach.json',
  obj05425: '/data/maps/0014/breach.json',
  obj05426: '/data/maps/0014/breach.json',
  obj05427: '/data/maps/0002/breach-05427.json',
  obj05428: '/data/maps/0014/breach.json',
  obj05429: '/data/maps/0010/breach.json',
  obj05430: '/data/maps/0011/breach.json',
  obj05432: '/data/maps/0006/breach.json',
  obj05433: '/data/maps/0006/breach.json',
  obj05434: '/data/maps/0020/breach.json',
  obj05435: '/data/maps/0020/breach.json',
  obj05436: '/data/maps/0020/breach.json',
  obj05442: '/data/maps/0018/breach.json',
  obj05443: '/data/maps/0006/breach.json',
  obj05445: '/data/maps/0007/breach.json',
  obj05460: '/data/maps/0020/breach.json',
  obj05461: '/data/maps/0020/breach.json',
  obj05462: '/data/maps/0020/breach.json',
  obj05466: '/data/maps/0007/breach.json',
  obj05467: '/data/maps/0021/breach.json',
  obj05468: '/data/maps/0021/breach.json',
  obj05469: '/data/maps/0017/breach.json',
};

export interface SceneBreachDestruction {
  library: string;
  reference: string;
}

export function sceneBreachLibrary(mapId: string, model: string,
                                  destruction?: SceneBreachDestruction): string | undefined {
  const published = mapLibraries[mapId]?.find(value => value.models.includes(model))?.library
    ?? modelLibraries[model];
  if (published) return published;
  return destruction ? `/${destruction.library}` : undefined;
}
