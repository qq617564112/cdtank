import type {RefObject} from 'react';
import type {HomeSourceUi} from '../resources/source-ui-layout';
import {GameScrollbar} from '../resources/game-scrollbar';

export function HomeEquipmentListScrollbar({list}: {
  list: RefObject<HTMLDivElement | null>; ui: HomeSourceUi; properties: Record<string, string>;
}) {
  return <GameScrollbar list={list} step={18} label="装备名单" data-home-equipment-list-scrollbar=""/>;
}
