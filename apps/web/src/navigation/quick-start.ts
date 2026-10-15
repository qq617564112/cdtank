export interface QuickStartOptions {mapId: 2 | 5 | 8; tankId: number; players: 10 | 12;}

/** A new match uses the saved account and the selected map's normal rules. */
export function readQuickStart(): QuickStartOptions | undefined {
  const path = location.pathname.replace(/\/$/, '');
  if (path !== '/quick-start' && path !== '/quick-start/team-12') return;
  const query = new URLSearchParams(location.search);
  const tankId = Number(query.get('tank') ?? 1);
  const team12 = path === '/quick-start/team-12';
  return {mapId: team12 ? 8 : query.get('map') === '5' ? 5 : 2, players: team12 ? 12 : 10,
    tankId: Number.isSafeInteger(tankId) && tankId > 0 ? tankId : 1};
}
