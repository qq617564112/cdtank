import {useSyncExternalStore, type Dispatch, type SetStateAction} from 'react';
import {disableBrowserNavigation} from './browser-navigation';

export type GamePage = 'login' | 'channels' | 'lobby' | 'room' | 'battle' | 'results' | 'closed';
export interface GameRoute {page: GamePage; roomId?: string;}

interface NavigationState {url: string; values: Readonly<Record<string, string>>; generation: number;}
const SESSION_KEY = 'cdtank-navigation-state';

function readNavigationState(value: unknown): NavigationState | undefined {
  if (!value || typeof value !== 'object' || !('url' in value) || typeof value.url !== 'string'
      || !('values' in value) || !value.values || typeof value.values !== 'object'
      || Array.isArray(value.values)) return;
  const values: Record<string, string> = {};
  for (const [key, item] of Object.entries(value.values)) {
    if (typeof item !== 'string') return;
    values[key] = item;
  }
  return {url: value.url, values,
    generation: 'generation' in value && typeof value.generation === 'number' ? value.generation : 0};
}

function readSessionState(): NavigationState | undefined {
  try {return readNavigationState(JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? 'null'));}
  catch {sessionStorage.removeItem(SESSION_KEY); return;}
}

function urlPath(url: URL): string {return url.pathname + url.search + url.hash;}

function publicParameter(url: URL, key: string): boolean {
  return key === 'dialogs' || (url.pathname.replace(/\/$/, '') === '/quick-start'
    && (key === 'map' || key === 'tank'));
}

const cachedState = readSessionState();
let generation = cachedState?.generation ?? 0;

function restoreNavigation(url: URL, state?: NavigationState): NavigationState {
  const privateValues: Record<string, string> = {};
  for (const [key, value] of [...url.searchParams]) {
    if (publicParameter(url, key)) continue;
    privateValues[key] = value;
    url.searchParams.delete(key);
  }
  const path = urlPath(url);
  return {url: path, generation,
    values: {...(state?.generation === generation && state.url === path ? state.values : {}), ...privateValues}};
}

let snapshot = restoreNavigation(new URL(location.href),
  readNavigationState(history.state?.cdtankNavigation) ?? cachedState);
let pending: {replace: boolean} | undefined;
const listeners = new Set<() => void>();
const publish = (): void => {listeners.forEach(listener => listener());};
const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {listeners.delete(listener);};
};
const getSnapshot = (): NavigationState => snapshot;

function saveSessionState(): void {sessionStorage.setItem(SESSION_KEY, JSON.stringify(snapshot));}
function saveHistoryState(replace: boolean): void {
  const state = {...history.state, cdtankNavigation: snapshot};
  if (replace) history.replaceState(state, '', snapshot.url);
  else history.pushState(state, '', snapshot.url);
}

saveSessionState();
saveHistoryState(true);

/** Browser traversal keeps the live page and selections without restoring older snapshots. */
export function reserveBrowserNavigation(): () => void {
  return disableBrowserNavigation(() => ({
    url: snapshot.url,
    state: {...history.state, cdtankNavigation: snapshot},
  }));
}

function currentUrl(): URL {return new URL(snapshot.url, location.origin);}

function currentValue(key: string): string | undefined {
  return snapshot.values[key];
}

function updateValue(values: NavigationState['values'], key: string, value?: string): NavigationState['values'] {
  if (values[key] === value) return values;
  const next = {...values};
  if (value === undefined) delete next[key];
  else next[key] = value;
  return next;
}

/** Batch one interaction's page, dialog and selection changes into one history entry. */
function commit(url: URL, values: NavigationState['values'], replace: boolean): void {
  const next = urlPath(url);
  if (next === snapshot.url && values === snapshot.values && snapshot.generation === generation) return;
  snapshot = {url: next, values, generation};
  saveSessionState();
  if (!pending) {
    pending = {replace};
    queueMicrotask(() => {
      const update = pending!;
      pending = undefined;
      saveHistoryState(update.replace);
    });
  } else if (!replace) pending.replace = false;
  publish();
}

export function readGameRoute(): GameRoute {
  const path = currentUrl().pathname.replace(/\/$/, '') || '/';
  const room = /^\/rooms\/([^/]+)(?:\/(battle|results))?$/.exec(path);
  if (room) return {page: room[2] === 'battle' ? 'battle' : room[2] === 'results' ? 'results' : 'room', roomId: room[1]};
  if (path === '/channels') return {page: 'channels'};
  if (path === '/lobby' || path === '/quick-start' || path === '/validation.html') return {page: 'lobby'};
  if (path === '/closed') return {page: 'closed'};
  return {page: 'login'};
}

export function useGameRoute(): GameRoute {
  useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return readGameRoute();
}

export function navigateGame(path: string, replace = false, clearState = false): void {
  if (location.pathname === '/validation.html') return;
  const url = currentUrl();
  url.pathname = path;
  if (clearState) {
    url.search = '';
    generation++;
  }
  for (const key of [...url.searchParams.keys()]) {
    if (!publicParameter(url, key)) url.searchParams.delete(key);
  }
  const values = clearState && Object.keys(snapshot.values).length ? {} : snapshot.values;
  commit(url, values, replace);
}

export function roomPath(roomId: string, phase?: string): string {
  const base = `/rooms/${encodeURIComponent(roomId)}`;
  return phase === 'FINISHED' ? `${base}/results`
    : phase === 'PLAYING' || phase === 'LOADING' ? `${base}/battle` : base;
}

function setNavigationValue(key: string, value?: string, replace = false): void {
  commit(currentUrl(), updateValue(snapshot.values, key, value), replace);
}

/** Restore private UI selections from the current history entry and tab session. */
export function useNavigationValue(key: string, initial = '', replace = false): [string, Dispatch<SetStateAction<string>>] {
  useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const read = (): string => currentValue(key) ?? initial;
  return [read(), value => {
    const next = typeof value === 'function' ? value(read()) : value;
    setNavigationValue(key, next === '' && initial === '' ? undefined : next, replace);
  }];
}

export function useNavigationChoice<T extends string>(key: string, choices: readonly T[], initial: T, replace = false):
    [T, Dispatch<SetStateAction<T>>] {
  const [raw] = useNavigationValue(key);
  const read = (): T => {
    const value = currentValue(key);
    return choices.find(choice => choice === value) ?? initial;
  };
  const value = choices.find(choice => choice === raw) ?? initial;
  return [value, next => setNavigationValue(key, typeof next === 'function' ? next(read()) : next, replace)];
}

export function useNavigationNumber(key: string, replace = false): [number | undefined, Dispatch<SetStateAction<number | undefined>>] {
  const [raw] = useNavigationValue(key);
  const parse = (value: string | undefined): number | undefined => {
    const number = value ? Number(value) : NaN;
    return Number.isSafeInteger(number) && number >= 0 ? number : undefined;
  };
  return [parse(raw), value => {
    const next = typeof value === 'function' ? value(parse(currentValue(key))) : value;
    setNavigationValue(key, next === undefined ? undefined : String(next), replace);
  }];
}

/** Dialog visibility is URL state, so refresh restores the current dialogs. */
export function useRouteDialog(name: string): [boolean, Dispatch<SetStateAction<boolean>>] {
  useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const read = (): string[] => currentUrl().searchParams.get('dialogs')?.split(',').filter(Boolean) ?? [];
  return [read().includes(name), value => {
    const dialogs = read();
    const open = typeof value === 'function' ? value(dialogs.includes(name)) : value;
    const next = dialogs.filter(dialog => dialog !== name);
    if (open) next.push(name);
    const url = currentUrl();
    if (next.length) url.searchParams.set('dialogs', next.join(','));
    else url.searchParams.delete('dialogs');
    if (!open) {
      const children: Record<string, readonly string[]> = {
        inventory: ['rename'], roles: ['upgradeTank', 'upgradeAction'],
        shop: ['purchaseItem'], 'room-edit': ['roomEditStep', 'editMode', 'editMap', 'editName', 'editMin', 'editMax', 'editTime', 'editFriendly', 'editMapMode', 'editMapPage'],
      };
      let values = snapshot.values;
      for (const key of children[name] ?? []) values = updateValue(values, key);
      commit(url, values, false);
    } else {
      commit(url, snapshot.values, false);
    }
  }];
}
