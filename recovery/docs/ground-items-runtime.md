# 地面掉落与拾取 domain 运行时

`apps/server/src/battle/items/drop-item-catalog.ts` 与
`apps/server/src/battle/items/ground-items.ts` 落地 M2-10 的地面物件 domain。
业务合同见 `ground-item-business-design.md`；本文件记录源码事实、采用规则、当前生产
接口和尚未接线的层级。

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
}
```

`DiscardGroundItemRequest` 带 `roomId/round/groundId/playerId/instanceId/itemTableId/
expectedQuantity/quantity`；`AcquireGroundItemRequest` 带
`roomId/round/groundId/playerId/itemTableId/quantity/source/ownerId?`。domain 不连接
SQL、不保存 connection map、不把 receipt 写入库存；持久层在成功回执中返回权威
`InventoryWireRecord`。

## 采用规则

- Breach 掉落：真实 HP 归零事件每次只调用一次。概率使用一次 `[0,1)` 权威均匀值，
  `<0.5` 才掉落；同一个成功值再映射 `{1,2,20001,20002}` 四等分池，因此条件概率各 1/4。
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
- 战斗数量：已有 hotkey 实例按本轮已消费配额扩展：
  `spent=max(0,min(oldOwned,BattleUseMax)-oldBattle)`，
  `newBattle=min(newOwned,max(0,BattleUseMax-spent))`。未占 hotkey 的新实例只增加 owned，
  不自动占槽；普通 WAITING 配置/再战仍走既有流程。
- CPU：没有账户绑定，只在本轮 local inventory 中合并已有堆叠；没有同表记录时分配不与
  旧实例冲突的正 uint32 local instance，并沿用 `InventoryWireRecord` 真实字段构造，
  不从 0x58 Treasure record 或未知 raw 字段推导拥有物。

## 未接线范围

本切片只交付两个 domain 源文件。`rooms/state.ts` 的 `groundItems`、`world.ts` 的
`startRoom` 清理、移动后接触扫描、Breach 归零掉落、`useAction(action=100)` 路由、
acquire/discard 回调注入，`rooms/snapshot.ts` 投影，shared `GroundItemSnapshot`/事件字段，
账户 `discardOwnedItem`/`acquireOwnedItem` 事务，以及 UI 模型/贴图表现均由对应 bridge
继续接入。本文不声称这些层已接线，也不声称网络、持久化、浏览器或构建验收通过。
