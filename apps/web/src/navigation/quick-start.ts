export interface QuickStartOptions {mapId: 2 | 5; tankId: number;}

/** A new match uses the saved account and the selected map's normal rules. */
export function readQuickStart(): QuickStartOptions | undefined {
  if (location.pathname.replace(/\/$/, '') !== '/quick-start') return;
  const query = new URLSearchParams(location.search);
  const tankId = Number(query.get('tank') ?? 1);
  return {mapId: query.get('map') === '5' ? 5 : 2,
    tankId: Number.isSafeInteger(tankId) && tankId > 0 ? tankId : 1};
}
