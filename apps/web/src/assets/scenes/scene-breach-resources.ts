interface SceneBreachLibrary {
  library: string;
  models: readonly string[];
}

/** Existing map libraries retain their source model and publication identity. */
const mapLibraries: Readonly<Record<string, readonly SceneBreachLibrary[]>> = {
  '0002': [
    {library: '/scene-breach-0002-05427.json', models: ['obj05427']},
    {library: '/scene-breach-0021.json', models: ['obj05422']},
    {library: '/scene-breach-0014.json', models: ['obj05425', 'obj05426', 'obj05428']},
  ],
  '0004': [
    {library: '/scene-breach-0004.json', models: ['obj05466']},
    {library: '/scene-breach-0021.json', models: ['obj05422']},
  ],
  '0005': [{library: '/scene-breach-0005.json', models: ['obj05425', 'obj05426', 'obj05432']}],
  '0006': [{library: '/scene-breach-0006.json', models: ['obj05421', 'obj05423', 'obj05443', 'obj05433', 'obj05432']}],
  '0007': [{library: '/scene-breach-0007.json', models: ['obj05466', 'obj05467', 'obj05468', 'obj05462', 'obj05423', 'obj05445']}],
  '0010': [{library: '/scene-breach-0010.json', models: ['obj05425', 'obj05426', 'obj05427', 'obj05428', 'obj05429']}],
  '0011': [{library: '/scene-breach-0011.json', models: ['obj05430']}],
  '0014': [{library: '/scene-breach-0014.json', models: ['obj05425', 'obj05426', 'obj05428']}],
  '0017': [{library: '/scene-breach-0017.json', models: ['obj05469']}],
  '0018': [{library: '/scene-breach-0018.json', models: ['obj05424', 'obj05442']}],
  '0020': [{library: '/scene-breach-0020.json', models: ['obj05460', 'obj05461', 'obj05462', 'obj05442', 'obj05434', 'obj05435', 'obj05436']}],
  '0021': [{library: '/scene-breach-0021.json', models: ['obj05422', 'obj05466', 'obj05467', 'obj05468']}],
  '0022': [{library: '/scene-breach-0022.json', models: ['obj05424', 'obj05469']}],
};

/** The same model uses its own c9 when placed on another original map. */
const modelLibraries: Readonly<Record<string, string>> = {
  obj05421: '/scene-breach-0006.json',
  obj05422: '/scene-breach-0021.json',
  obj05423: '/scene-breach-0006.json',
  obj05424: '/scene-breach-0018.json',
  obj05425: '/scene-breach-0014.json',
  obj05426: '/scene-breach-0014.json',
  obj05427: '/scene-breach-0002-05427.json',
  obj05428: '/scene-breach-0014.json',
  obj05429: '/scene-breach-0010.json',
  obj05430: '/scene-breach-0011.json',
  obj05432: '/scene-breach-0006.json',
  obj05433: '/scene-breach-0006.json',
  obj05434: '/scene-breach-0020.json',
  obj05435: '/scene-breach-0020.json',
  obj05436: '/scene-breach-0020.json',
  obj05442: '/scene-breach-0018.json',
  obj05443: '/scene-breach-0006.json',
  obj05445: '/scene-breach-0007.json',
  obj05460: '/scene-breach-0020.json',
  obj05461: '/scene-breach-0020.json',
  obj05462: '/scene-breach-0020.json',
  obj05466: '/scene-breach-0007.json',
  obj05467: '/scene-breach-0021.json',
  obj05468: '/scene-breach-0021.json',
  obj05469: '/scene-breach-0017.json',
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
