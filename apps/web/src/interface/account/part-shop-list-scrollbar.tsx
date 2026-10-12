import type {RefObject} from 'react';
import type {HomeSourceUi} from '../resources/source-ui-layout';
import {GameScrollbar} from '../resources/game-scrollbar';
import './part-shop-list-scrollbar.css';

export function PartShopListScrollbar({list}: {
  list: RefObject<HTMLDivElement | null>; ui: HomeSourceUi; properties: Record<string, string>;
}) {
  return <GameScrollbar list={list} step={48} label="零件商店名单" data-part-shop-list-scrollbar=""/>;
}
