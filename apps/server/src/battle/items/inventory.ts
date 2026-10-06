import type {BattleItemRecord} from '../../../../shared/combat/item-hotkeys';

export interface KitbagInventory {
  readonly primary: BattleItemRecord[];
  readonly secondary: BattleItemRecord[];
}

