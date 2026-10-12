import type {RefObject} from 'react';
import type {HomeSourceUi} from '../resources/source-ui-layout';
import {GameScrollbar} from '../resources/game-scrollbar';

export function HomeOwnedRoleListScrollbar({list}: {
  list: RefObject<HTMLDivElement | null>; ui: HomeSourceUi; properties: Record<string, string>;
}) {
  return <GameScrollbar list={list} step={48} label="拥有角色名单" data-home-owned-role-list-scrollbar=""/>;
}
