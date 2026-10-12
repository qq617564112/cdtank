import type {RefObject} from 'react';
import type {HomeSourceUi} from '../resources/source-ui-layout';
import {GameScrollbar} from '../resources/game-scrollbar';
import './role-shop-source-list.css';

export function RoleShopListScrollbar({list}: {
  list: RefObject<HTMLDivElement | null>; ui: HomeSourceUi; properties: Record<string, string>;
}) {
  return <GameScrollbar list={list} step={48} label="猫狗和坦克商店名单" data-role-shop-list-scrollbar=""/>;
}
