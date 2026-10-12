import type {RefObject} from 'react';
import type {HomeSourceUi} from '../resources/source-ui-layout';
import {GameScrollbar} from '../resources/game-scrollbar';

export function HomeInventoryScrollbar({list}: {
  list: RefObject<HTMLDivElement | null>; ui: HomeSourceUi; properties: Record<string, string>;
}) {
  return <GameScrollbar list={list} step={38} label="拥有物品名单" data-home-inventory-list-scrollbar=""/>;
}
