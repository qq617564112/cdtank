# 地面掉落与拾取 domain 运行时

`apps/server/src/battle/items/drop-item-catalog.ts` 与
`apps/server/src/battle/items/ground-items.ts` 落地 M2-10 的地面物件 domain。
业务合同见 `ground-item-business-design.md`；本文件记录源码事实、采用规则和当前生产桥。

## 来源事实

- `dropitem.dat` 实读 14 行，列为 `ItemType/Min/Max/ItemID/ItemTexture/SoundFile/EffectFile`。
  `ItemType` 前两位是库存类别 1..6，末位是类别内档位；类别 7 没有行。
  类别 2 在 quantity 5 有 `021`/`022` 重叠，按表内顺序取首个匹配行。
- `ItemID` 是 `obj05001–obj05011` 场景模型，`ItemTexture` 为 `A/B`，声音为
  `GA21–GA28`，效果字符串为 `44`。该表不包含 ItemTable ID、拥有量、概率或账户奖励。
- `UMsgPickupItem` 与 `UMsgPickupTreasure` 的已恢复 receiver 只按身份/坐标清除场景节点，
  不写 MyItem 数量，也不直接改账户库存。0x58 Treasure record 与 0x30 MyItem 不是同一身份。
- 类别 1/2 已有持久库存与普通使用路径；类别 6 的取得 writer 未在原来源恢复，采用持久
  库存加一，后续效用仍走物品自身的普通使用链。

## 落地产物

`drop-item-catalog.ts` 在模块加载时读取一次 `sourceTablePath('dropitem')`，解析后缓存
`DropItemVisual` 行。`selectDropVisual(itemTableId, quantity)`：

1. 用 `itemTableId` 查现有 `combatItems`，且用 `classifyInventoryCategory` 判真实库存类别；
2. 只接受类别 1..6 和正整数 quantity；
3. 按源表顺序取首个满足 `Min <= quantity <= Max` 的类别行；
4. 返回 `{modelId, texture, soundId, effectId}`，其中声音和效果保持源字符串；
5. 没有合法行或源视觉不完整时返回 `undefined`，调用方不得扣库存或生成实体。

`ground-items.ts` 导出与 shared 投影同形的 `GroundItemState`：
`id/itemTableId/quantity/modelId/texture/soundId/effectId/x/y/z/source/ownerId?/createdAt`。
`ownerId` 只作信息字段，不限制拾取；`createdAt` 由调用方传入真实服务端毫秒时钟。

## domain producer

| 导出 | 行为 |
| --- | --- |
| `createBreachDrop(room, source, ownerId, now, random, normalEvents)` | 只为 mode5、`PLAYING`、已转为 0 HP 的源 Breach 生成一次；真实位置取 `source.x/y/z`；不写点数、生命或其它效果。 |
| `discardToGround(room, player, instanceId, now, callbacks, normalEvents)` | 普通 `action=100` 的一份丢弃；先做本地资格和视觉校验，再调用权威 discard callback，成功后才生成 `DISCARD` 地面实体。 |
| `advanceGroundItems(room, now, callbacks, normalEvents)` | 在移动后由 World 调用；扫描 `PLAYING` 房间内存活且 `status===2` 的玩家，逐实体按三维 XYZ 距离 `<=40` 接触。 |
| `pickupGroundItem(room, player, groundId, callbacks, normalEvents)` | 复用接触资格；真人走 acquire callback，CPU 只走本轮 local 库存；成功后删除实体并产生拾取/删除事件。 |
| `clearGroundItems(room)` | 清空本轮实体、counter 和 Breach 触发记录；不向任何 source owner 退款。 |
| `groundItemSnapshot(state)` | 返回实体字段副本。 |

回调边界：

```ts
type DiscardGroundItem = (
  request: DiscardGroundItemRequest,
) => InventoryWireRecord | undefined;

type AcquireGroundItem = (
  request: AcquireGroundItemRequest,
) => {record: InventoryWireRecord; refreshPlayerIds?: readonly string[]} | undefined;

interface AcquireDiscardCallbacks {
  acquire?: AcquireGroundItem;
  discard?: DiscardGroundItem;
  roundUse?: (playerId: string, itemTableId: number) => number;
}
```

`DiscardGroundItemRequest` 带 `roomId/round/groundId/playerId/instanceId/itemTableId/
expectedQuantity/quantity`；`AcquireGroundItemRequest` 带
`roomId/round/groundId/playerId/itemTableId/quantity/source/ownerId?`。domain 不连接
SQL、不保存 connection map、不把 receipt 写入库存；持久层在成功回执中返回权威
`InventoryWireRecord`。

## 采用规则

- Breach 掉落：真实 HP 归零事件每次只调用一次。概率使用一次 `[0,1)` 权威均匀值，
  `<0.5` 才掉落；同一个成功值再映射 `{1,2,2010,20001,20002}` 五等分池，因此条件概率各 1/5。
  每次只生成 quantity 1；重生只恢复源目标，不重放已生成/已领取实体。
- 身份：`GROUND` counter 属于服务端进程随机 UUID 加 `roomId/round`，
  `counter` 每轮从 1 单调递增；同轮稳定，换轮不复用。
- 丢弃：只接受当前库存中的精确实例，且 `state===0`、类别 1/2、owned/battle 均正、
  有 dropitem 视觉，普通弹药 2001、已装配部件和类别 3..6 不进入丢弃路径。
  quantity 固定一份。真人先由持久 callback 按 `expectedOwned` 做 CAS，成功返回更新后的
  权威记录，domain 才更新本地库存并创建地面实体；失败/异常不扣本地库存、不产生实体。
  CPU 只在本地库存扣一，无账户 grant。
- 拾取：实体接触半径采用三维 XYZ `<=40`，不增加 Y/地形高度门禁，也不信任客户端
  `clientTime`。真人必须由 World 先在认证/房间/轮次/状态门禁内调用 callback；
  `(roomId, round, groundId, playerId)` 交给持久层作为 receipt 键。callback 成功后
  domain 才移除实体并生成拾取/删除事件；失败保留实体，不重复 late force-consume。
  同一账户多连接只通过 callback 返回的 `refreshPlayerIds` 刷新已绑定的在房角色。
- 战斗数量：World 以真实成功 `consumeItem` 回调累计本轮每玩家/物品使用量。`ownedQuantity`
  已经扣过真实消费，`roundUse` 只限制剩余可用上限：已占 hotkey 的实例按
  `battleQuantity=max(0,min(ownedQuantity,max(0,BattleUseMax-roundUse)))` 更新；未占 hotkey
  的实例为 0，不自动占槽。重置只发生在新 round 或离场，拾取、丢弃和连接刷新不会重置或
  补回本轮已消耗额度；数量归零清实例时同步清 hotkey。
- CPU：没有账户绑定，只在本轮 local inventory 中合并已有堆叠；没有同表记录时分配不与
  旧实例冲突的正 uint32 local instance，并沿用 `InventoryWireRecord` 真实字段构造，
  不从 0x58 Treasure record 或未知 raw 字段推导拥有物。

## 生产桥

`World.startRoom`、`beginRoomLoading` 和终局清理调用 `clearGroundItems`；移动结算后、
投射物处理前调用 `advanceGroundItems`。mode5 的真实 Breach HP 归零在
`objectiveEnd`/finish 之前调用 `createBreachDrop`，其它 mode、Castle 和普通 scene
object 不产生该掉落。真实重生建立新的 `destroyedAt` 时可再次掷骰，旧的同值不会重放。

普通 `PlayerAction` 的 `action=100` 使用 current selected hotkey 中的 instanceId 作为
`value`。World 在认证参与者、房间、round、intro 后和 PLAYING 门禁内检查普通 sequence
watermark、hotkey 实例、owned/battle 正量及真实丢弃资格，再调用同一份
`discardToGround`。一次丢弃固定一份，不新增 action1/2。

`index.ts` 将 `AccountStore.acquireOwnedItem`/`discardOwnedItem` 注入最小
`AcquireDiscardCallbacks`。acquire 从本 player 的 clientId 解析真实账户，域请求的
`expectedQuantity` 映射为账户 API 的 `expectedOwned`；只有持久回调成功返回权威记录后
才移除地面实体。discard 的归零回执转成同实例 `ownedQuantity=0` 记录以清 local hotkey。
同一账户在其它房间的活跃参与者通过最小 `reconcileGroundItemInventory` 只刷新该实例，
不重建整个 inventory，也不重置本局已用额度或 `RoleCombatState`。

真实 ground 库存写入（拾取 acquire、丢弃 discard）经 `syncGroundItemRecord` 提交后，World
对同一 account 的全部在房真人参与者（含其它房间）各产生一次普通 `MsgRoomEvent`
`type='inventoryChanged'`，`roomId`/`playerId`/`targetId` 取该参与者的房间与 id，其它 required
字段为 0/`''`；事件不携带 account 身份。它只在真实库存变更后发出，不对 CPU grant、不每 tick
轮询，也不因 receipt 空变化触发。消费者据此重查本机 Inventory RPC，无需新增 RPC 或快照字段。

房间快照继续由既有 `rooms/state.ts`/`rooms/snapshot.ts` 的单一 `groundItems` 列表投影；
本桥没有新增第二份实体表或 shared 字段。

## 验证边界

本文件记录生产路径接线与领域事实，不声称 tests、浏览器、build、typecheck、lint、原生
导出、网络多连接或持久化实测已经通过。
