# Treasure item client configuration

This note records the client-side configuration range for the two recovered treasure items:

| ItemTableID | Name | Inventory category | ItemType | BattleUseMax | ItemSkill1 | ItemSkill2 |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| 20001 | 鱼骨 | 6 | 13 | 0 | 20001 | 30005 |
| 20002 | 骨头 | 6 | 13 | 0 | 20002 | 30005 |

The source item rows keep `ItemMoney=0`, `ItemCoin=0`, `GGet=0` and `Durable=0`. The two rows are not generalized into a free shop path, a gift path, or a category-6 open inventory page.

## Player configuration path

`HomeInventoryView` keeps the original Weapon / Item / Valuable tabs and their source layouts. The Item page continues to show normal category-1 records, and also includes only owned records whose `itemTableId` is exactly `20001` or `20002`. The Valuable page continues to show category-6 records with its original list, row content and confirmed quantity label.

Selecting or dragging one of these two records on the Item page uses the existing `ASSIGN` request path. The current slot numbering maps Item slots 4-7 to battle keys 5-8, and the server kitbag authority accepts `1..4000` or `20001..21000`. Cancellation and clearing use the same existing `CANCEL` path.

The client does not create owned records. Only confirmed `Inventory` rows returned by the account query are rendered, and zero-quantity rows remain hidden. The existing account query refresh remains the ownership source.

The adopted configured-hotkey policy for these two items treats the usable count as the confirmed owned quantity when their source `BattleUseMax` is zero. The server-side policy and `ItemSkill2` execution are outside this UI slice.

## Known gaps

The original `ItemSkill2=30005` effect is not implemented by this client configuration change. The item description says 15 HP while the recovered skill row says HP30; this note does not pick either value as the final runtime result.

No browser acceptance, type check, build, or actual battle verification was run for this slice.
