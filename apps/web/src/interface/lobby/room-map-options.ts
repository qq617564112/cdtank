import type {MapOption} from '../../../../shared/protocols/PtlListMaps';

/** Eight source map positions, filtered by the authoritative mode directory. */
export function roomMapPage(maps: readonly MapOption[], mode: number, requestedPage: number,
  selectedId: number) {
  const available = maps.filter(map => map.mode === mode);
  const pages = Math.ceil(available.length / 8);
  const page = Math.max(0, Math.min(Number.isInteger(requestedPage) ? requestedPage : 0, pages - 1));
  const selected = available.find(map => map.mapId === selectedId);
  return {page, pages, maps: available.slice(page * 8, (page + 1) * 8), selected};
}

/** Original 4a5c12 preview producer: map record+0xc, xiaoditu0 and %.4d.tga. */
export function roomMapPreviewReference(mapId: number): string | undefined {
  if (!Number.isSafeInteger(mapId) || mapId <= 0) return undefined;
  return `set:xiaoditu0 image:${['data', 'ui', 'xiaoditu', `${String(mapId).padStart(4, '0')}.tga`].join('\\')}`;
}
