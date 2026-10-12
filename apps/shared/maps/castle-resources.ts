/** Castle actions belong to the model; each scene supplies its own placement. */
export function castleResourceFile(mapId: number): string {
  const libraryMapId = [2, 5, 6, 10, 11].includes(mapId) ? mapId
    : [1, 3, 8, 12, 13].includes(mapId) ? 2
    : mapId === 23 ? 23 : 2;
  return `data/maps/${String(libraryMapId).padStart(4, '0')}/castle.json`;
}
