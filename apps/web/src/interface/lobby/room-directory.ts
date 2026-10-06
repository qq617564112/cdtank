import type {RoomSummary} from '../../../../shared/protocols/PtlListRooms';

export type RoomSort = 'ID' | 'EMPTY';
/** Original roomlist.xml has picRoomIcon0 through picRoomIcon9. */
export const ROOM_PAGE_SIZE = 10;

export interface RoomDirectoryPage {
  rooms: RoomSummary[];
  page: number;
  pages: number;
  selectedId: string;
}

/** Rebuilt page/selection lifecycle over an already globally sorted directory. */
export function roomDirectoryPage(ordered: readonly RoomSummary[], requestedPage: number,
  previousId: string, followSelection = false): RoomDirectoryPage {
  const pages = Math.ceil(ordered.length / ROOM_PAGE_SIZE);
  let page = Math.min(Math.max(0, Math.trunc(requestedPage)), Math.max(0, pages - 1));
  if (followSelection) {
    const index = ordered.findIndex(room => room.id === previousId && canJoinRoom(room));
    if (index >= 0) page = Math.floor(index / ROOM_PAGE_SIZE);
  }
  const rooms = ordered.slice(page * ROOM_PAGE_SIZE, (page + 1) * ROOM_PAGE_SIZE);
  return {rooms, page, pages, selectedId: selectDirectoryRoom(rooms, previousId)};
}

export function canJoinRoom(room: RoomSummary): boolean {
  return room.phase !== 'PLAYING' && room.phase !== 'LOADING' && room.playerCount < room.maxPlayers;
}

function compareId(left: string, right: string): number {
  const a = /^R\d+$/.test(left) ? Number(left.slice(1)) : NaN;
  const b = /^R\d+$/.test(right) ? Number(right.slice(1)) : NaN;
  const numericA = Number.isSafeInteger(a), numericB = Number.isSafeInteger(b);
  if (numericA !== numericB) return numericA ? -1 : 1;
  if (numericA && numericB && a !== b) return a - b;
  return left < right ? -1 : left > right ? 1 : 0;
}

/** Rebuilt comparator for the recovered ID/empty-room controls. */
export function orderRooms(rooms: readonly RoomSummary[], sort: RoomSort): RoomSummary[] {
  return [...rooms].sort((a, b) => {
    if (sort === 'EMPTY') {
      const availability = Number(canJoinRoom(b)) - Number(canJoinRoom(a));
      if (availability) return availability;
      const spaces = (b.maxPlayers - b.playerCount) - (a.maxPlayers - a.playerCount);
      if (spaces) return spaces;
      if (a.playerCount !== b.playerCount) return a.playerCount - b.playerCount;
    }
    return compareId(a.id, b.id);
  });
}

export function selectDirectoryRoom(rooms: readonly RoomSummary[], previousId: string): string {
  return rooms.find(room => room.id === previousId && canJoinRoom(room))?.id
    ?? rooms.find(canJoinRoom)?.id ?? '';
}
