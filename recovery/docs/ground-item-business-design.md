# 地面掉落与拾取业务设计与实施合同

M2-10 完整掉落子项。本文把「原客户端地面物件通信已经证明什么」与「为了可执行而采用的
重建业务规则」分列，直接指导下一批 server/shared/UI 实现。采用规则不冒称原 Windows 服务端
逐行为复刻；未实测部分保持未完成，不因原 server writer 缺失而禁用掉落，也不把场景物件
消失当作账户取得。

覆盖消息：`UMsgDiscardItem`(0x3c96/441155)、`UMsgPickupItem`(0x3c98/441382)、
`UMsgPickupTreasure`(0x3caa/44162c)、`UMsgDeleteGroundItem`(0x3ca0/441e13)，
以及同族的 `UMsgDiscardTreasure`(0x3ca9/44233c)、`UMsgDeleteTreasure`(0x3cab/43dab8)。
现 shared 协议版本以 `apps/shared/protocols/serviceProto.ts` 的 101 为准，本子项只做手工
追加，不运行生成器。

## 原来源事实

### 具名 receiver 与注册

`442595` 用 `43c228` 绑定 `441382`，名称 `5c5734 UMsgPickupItem`；`4425d7` 用 `43c266`
绑定 `44162c`，名称 `5c5720 UMsgPickupTreasure`。库存管理器 `4423ae` 注册的两个成功
通知即这两个 receiver，不重复拥有表或道具消费入口。完整虚表、包体指令与两个 receiver
的反汇编见 [来源索引](../output/ground-pickup-receiver-source.json)。

### 成功通知只做场景清除

| 消息 | 包体（读序） | receiver 行为 |
| --- | --- | --- |
| UMsgPickupItem 3c98 | 16位 itemTableId(+c)、32位 field10(+10)、f32 x(+14)、f32 z(+18)、1位 success(+1c)，共 113 位 | success 非零、ItemTable(fieldC) 可查、场景 provider 存在才继续 |
| UMsgPickupTreasure 3caa | 1位 success(+14)、32位 field10(+10)，success 后再经 `41da1d/41dad0` 写读一条 0x58 嵌套记录 | success 非零、场景 provider 与 manager+a8 树节点坐标匹配才继续 |

- `441382` 遍历 manager+9c 场景树，按被引用 Itemrecord+0xc 与 `+0x14/+0x18` 坐标窗口
  匹配场景节点，`4595f9` 移除模型、`457ca0` 刷新、可选 `+0xc0` 观察器、`43cdd8`/`43c9e5`
  释放并 erase 节点。
- `44162c` 遍历 manager+a8 场景树，按节点 `+0x48/+0x50` 坐标匹配，两个模型名分别交
  `4595f9` 移除，之后 `457ca0` 刷新、可选 `+0xc0` 回调、`43ce02`/`43c9e5` 释放并 erase。
- 坐标窗口常量 `0x5c1550` 是 double `0.001`；比较为 `|node - packet| <= 0.001`，
  即成功通知回显生成位置，不是玩家接触半径。
- `field10` 与 `413f60` 比较仅控制本机提示/声音；远端成功通知仍执行场景移除。
- 两个 receiver 都没有直接调用 `43d583`/`43d122`/`440fd7`，都没有写 MyItem 数量，
  都没有直接改账户库存。它们可见的合同就是「成功后清除场景节点」。

因此：**模型消失不等于取得库存**；库存写入必须由重建服务端在持久事务里完成。

### 丢弃与删除地面物件的原指令

以下为直接读取原 PE 字节得到的部分反汇编（`CDTank.exe`，ImageBase 0x400000），
只描述到已确认的字段和调用，不声称完整函数已全部执行。

- `UMsgDiscardItem` 3c96/441155：门禁为 packet+0x10 字节非零、`game+0x118` controller
  非零、`4269c4` 谓词为真、`0x635830+0x60` 场景非零。随后从 packet+0xc 取嵌入道具记录
  指针，读记录 `+0xc` 身份与 `+0x24/+0x28` 坐标 f32，构造位置并进入 `45aeb6` 场景生成，
  再 `457ca0` 刷新、可选 `+0xc0` 回调、erase 旧节点。这是「服务端通知客户端在丢弃位置
  生成地面物件」的入口。
- `UMsgDeleteGroundItem` 3ca0/441e13：读 packet+0xc 身份、packet+0x10 f32 x、packet+0x14 f32 z；
  遍历 manager+0xa0 列表，按 record+0xc 身份和 record `+0x24/+0x28` 坐标、窗口 `0.001`
  匹配，`4595f9` 移除模型、`457ca0` 刷新、可选 `+0xc0` 回调、erase 节点。即按身份+位置
  删除地面物件。
- `UMsgDiscardTreasure` 3ca9/44233c 与 `UMsgDeleteTreasure` 3cab/43dab8：门禁与
  `game+0x124+0x60` 场景、manager+0xa0/a8 树和 `44e081` 模型→GA 声音分派相关；
  本子项不把它们解码成拥有库存字段。

### Treasure 0x58 与 MyItem 0x30 是不同身份

`43fe8b` 在 success 时分配 0x58 字节记录并由 `41dad0` 读入；`41da1d` 写序为
`+0(8位)、+4(24位)、+8(16位)、+0xc(16位)、+0x10(字符串)、+0x48(32位)、+0x4c(32位)、+0x50(32位)、+0x54(16位)`。
这与共同库存记录 `InventoryWireRecord`（MyItem，0x30 字节，`instanceId/itemTableId/ownedQuantity/
battleQuantity/state/float 原位` 见 `apps/shared/protocols/PtlInventory.ts` 与
`inventory-wire.md`）不是同一身份。**不能把 0x58 嵌套记录里的 `+4` 等字段偷换成拥有实例
ID 或库存量**，也不能据它给账户写任意 owned 字段。

### dropitem 数据表实际支持什么

`dropitem.dat` 实读 14 行，列为 `ItemType/Min/Max/ItemID/ItemTexture/SoundFile/EffectFile`：

| ItemType | Min–Max | ItemID | Texture | Sound | Effect |
| --- | --- | --- | --- | --- | --- |
| 011 | 1–20 | obj05008 | B | GA21 | 44 |
| 012 | 21–40 | obj05007 | B | GA22 | 44 |
| 013 | 41–999 | obj05006 | B | GA23 | 44 |
| 021 | 1–5 | obj05008 | A | GA21 | 44 |
| 022 | 5–9 | obj05007 | A | GA22 | 44 |
| 023 | 10–999 | obj05006 | A | GA23 | 44 |
| 031 | 1–5 | obj05005 | A | GA24 | 44 |
| 032 | 6–10 | obj05004 | A | GA24 | 44 |
| 033 | 11–999 | obj05003 | A | GA24 | 44 |
| 041 | 1–3 | obj05011 | A | GA25 | 44 |
| 042 | 4–6 | obj05010 | A | GA25 | 44 |
| 043 | 7–999 | obj05009 | A | GA25 | 44 |
| 051 | 1–1 | obj05002 | A | GA26 | 44 |
| 061 | 1–1 | obj05001 | A | GA28 | 44 |

可判定事实：该表是**类别→地面模型/贴图/声音/特效**表；`ItemID` 是场景模型
`obj05001–obj05011`（已发布对应 `.glb`），`EffectFile` 全是已发布效果 44，
`ItemTexture` 为 A/B，`SoundFile` 为已发布 GA21–GA28。它**不含** ItemTable ID、
概率、货币、经验或账户奖励字段。`Min/Max` 是递增数值区间，用于在类别内选择档位。

### 既有类别6账户写入能否从现来源证明

不能。现来源中类别 6（20001–22000）的原写入只有**出售**路径：
`495e90` kind5 → `494bad(instance,quantity)` → 成功后 `495591` 调
`43d583(instance,replyquantity,6)`、`43d122` 扣 MyItem+10 或释放实例，见
`valuable-item-sale-contract.md`。没有任何已恢复来源证明类别 6 的**增加**（拾取入账）。
因此本项目对类别 6 的入账只能作为采用规则，且必须走现 `inventory` 持久 schema，
不得由 0x58 treasure record 反推。

## 采用业务政策

本节是可实施合同。所有未由原来源证明的选择都明确标注为采用规则；数值有界、可替换，
不改动原表、不新增兼容框架/feature flag/hash。

### 地面实体模型

新增服务器权威实体 `GroundItemState`，客户端只读投影 `GroundItemSnapshot`：

| 字段 | 语义 |
| --- | --- |
| `id` | 稳定身份 `${roomId}:${round}:G${counter}`；同房同轮单调、跨轮不复用 |
| `itemTableId` | 合法 ItemTable ID；由 3c98 身份路径或丢弃记录给出，不从模型反推 |
| `quantity` | 正整数，本次掉落数量；决定 dropitem 档位 |
| `modelId`/`texture`/`soundId`/`effectId` | 由 `dropitem` 选定，见下 |
| `x`/`y`/`z` | 服务端权威位置（Breach 用源矩阵，丢弃用玩家当前位） |
| `source` | `'BREACH'` 或 `'DISCARD'` |
| `ownerId?` | 击毁者或丢弃者，仅信息用途，不限制拾取 |
| `createdAt` | 服务端 true clock（现有 `World` 注入 `now()=Date.now`）毫秒，不采用客户端 `clientTime` |

实体在本轮内不移动、不自动重生；生命周期到被拾取或本轮结束。

### dropitem 档位选择（采用规则）

采用规则：把 `ItemType` 解释为 `<两位类别><一位档位>`。两位类别与
`classifyInventoryCategory` 的 1..6 对应；档位取 `ItemType` 末位，按
`Min <= quantity <= Max` 选择。类别 7（30001–33000 部件）无掉落行。例：类别 1、
数量 1 → 行 011 → `obj05008/B/GA21/44`。

这是采用解释，不是恢复的原 item→模型选择；原表未携带 ItemTable ID，无法证明逐物件
对应。若某 itemTableId 的类别无掉落行，则拒绝生成 ground（丢弃时向本人回拒绝，
不扣库存）。`dropitem.dat` 只提供模型/声音/特效，不产生账户价值。

### 两类掉落来源与是否同池

采用规则：丢弃掉落与 Breach 掉落**共用同一 ground 实体、同一身份/快照/协议、同一
dropitem 档位选择和同一拾取事务**；两者的**item 来源**不同：

| 来源 | item 身份 | 数量 | 位置 |
| --- | --- | --- | --- |
| `'DISCARD'` | 玩家丢弃的精确实例 `itemTableId`（保持实例身份语义） | 与持久扣减一致的 `quantity` | 丢弃瞬间玩家服务端位置 |
| `'BREACH'` | 从显式掉落池随机选取 | 1 | 被摧毁 Breach 的源矩阵位置 |

### Breach 掉落池与概率（采用规则）

- 触发：模式 5 的 DESTROY 目标由 HP>0 转为 0 的既存 `objectiveDestroyed` 权威事件。
- 概率：每次摧毁从服务端 RNG 取一个 `[0,1)` 均匀值，小于 `0.5` 时掉落；否则不掉。
  0.5 是采用值，原服务端概率未取得，不猜原概率。
- 池：`{itemTableId 1, itemTableId 2}`（宠物饲料/大包的宠物饲料），各 quantity 1，
  等概率。选这两项的采用理由是：它们有已验证的持久 schema 与普通使用/治疗闭环
  （`healing-item-runtime.md`），拾取后可由正常 item-use 路径产生 HP 效果。
- 每次摧毁最多生成一个 ground；目标重生（`ButtReborn`）不重放掉落、不重建已领取
  实体，下一次摧毁是新的掉落判定。

### 拾取资格与触发（采用规则）

服务端在 `PLAYING` 内解析，任一条件不满足则保实体、不扣不加：

1. 同房间、同 `round`、实体未被领取。
2. 普通玩家接触：玩家服务端坐标与实体距离 `<= GROUND_PICKUP_RADIUS`（采用值 40 世界单位，
   与现有 `BODY_RADIUS=20` 同体系）；或明确普通 input（见协议扩展）。
3. 认证活体：真人需有 `accountByConnection` 绑定；CPU 无账户，只写本轮本地库存。
4. 距离与存活以服务端状态为准，不信任 `MsgPlayerInput.clientTime`。

### 效用（采用规则）

- 拾取一律把 `itemTableId × quantity` 写入 owned 库存；这是唯一取得作者。
- 拾取本身不写 HP：已恢复的 3c98/3caa receiver 只清场景，无 HP 写入；HP/其它战斗效果由
  该物件已恢复并已验证的**普通使用**路径（如类别 1 的 `applyHealingItem`）产生，不在拾取
  时臆造第二次效果。
- 类别 6 贵重品不进入 Breach 池；其拾取入账若要实现，必须用 known itemTableId 走现
  inventory schema，**不得**解码 0x58 treasure record 映射 owned 字段。

### 不复制持久价值（采用规则）

- 拾取把持久价值搬入账户后，实体即从 `groundItems` 移除，快照与事件都只反映这一次取得；
  同一 `id` 不能被第二个玩家或第二次接触再领，实体移除与 `acquireOwnedItem` 在同一
  `PLAYING` tick 的同一分支内完成，不产生「实体还在但价值已加」的窗口。
- `'DISCARD'` 的持久价值先由 `discardOwnedItem` 从账户原实例扣出，再作为 ground 存在；
  若被本人重新拾取，`acquireOwnedItem` 只加回 `quantity`，不复制出第二份库存。实例身份
  允许被合并到同 `itemTableId` 的堆叠记录，不保留原实例 ID 的第二次写入。
- Breach 掉落池物件不是从任何账户扣除，因此其拾取是净取得；重生只按 `ButtReborn` 恢复
  目标，不再重放已领取的实体，也不重放掉落。

## 数据与接口合同

### shared 协议

`apps/shared/protocols/MsgRoomSnapshot.ts`：

```ts
export interface GroundItemSnapshot {
  id: string;
  itemTableId: number;
  quantity: number;
  modelId: string;   // 原 dropitem ItemID，如 'obj05008'
  texture: 'A' | 'B';
  soundId: string;   // 如 'GA21'
  effectId: string;  // '44'
  x: number; y: number; z: number;
  source: 'BREACH' | 'DISCARD';
  ownerId?: string;
  createdAt: number; // 服务端毫秒
}
```

`MatchSnapshot` 追加可选 `groundItems?: GroundItemSnapshot[]`，与既有 `groundTraps?` 同形，
旧 fixture 可省略。`apps/shared/protocols/MsgRoomEvent.ts` 复用现有事件信封，最小追加：

```ts
groundItemDropped?: GroundItemSnapshot;
groundItemPickedUp?: {id: string; playerId: string; itemTableId: number; quantity: number};
groundItemRemoved?: {id: string};
```

`serviceProto.ts` 手工追加上述字段/类型，`version` 保持 101；不跑生成器、不加原未证偏移。

### shared/server 库存事务

在 `apps/server/src/account-store.ts`（沿用既有 `inventory` 表、`InventoryWireRecord`、
`BEGIN IMMEDIATE`/`COMMIT`/`ROLLBACK` 模式）新增：

```ts
discardOwnedItem(accountId, instanceId, expectedOwned, itemTableId, quantity): boolean;
acquireOwnedItem(accountId, itemTableId, quantity): {instanceId: number; ownedQuantity: number} | undefined;
```

- `discardOwnedItem`：单事务内校验 `instanceId/itemTableId` 与 `ownedQuantity === expectedOwned
  && quantity >= 1 && quantity <= ownedQuantity`，扣减；归零则删行。成功返回 true 才继续生成 ground。
- `acquireOwnedItem`：单事务内对相同 `itemTableId` 的可堆叠实例 `ownedQuantity += quantity`，
  否则以现 `allocateInstanceId` 语义分配未用 uint32 新实例写入；失败返回 undefined。
- 两个方法只动 `ownedQuantity` 与实例存在性，保持 `state/field8/float*` 原位字段，不碰
  快捷槽之外的其它账户。

### server 地面物件模块

新增 `apps/server/src/battle/items/drop-item-catalog.ts`：用 `sourceTablePath('dropitem')`
读现 `recovery/output/verified/tables/dropitem.json`，导出
`selectDropVisual(itemTableId, quantity): {modelId; texture; soundId; effectId} | undefined`。

新增 `apps/server/src/battle/items/ground-items.ts`：

| 函数 | 职责 |
| --- | --- |
| `createBreachDrop(room, objective, ownerId, now, random, events)` | 按 0.5 与池生成实体并广播 |
| `discardToGround(room, player, instanceId, now, discard, events)` | 校验类别→事务扣量→成功建 ground |
| `advanceGroundItems(room, now, acquire, events)` | 服务端接触扫描，满足资格时走 `pickupGroundItem` |
| `pickupGroundItem(room, player, id, now, acquire, events)` | 明确 input 路径，复用同一资格与事务 |
| `clearGroundItems(room)` | 本轮清理，不退库存 |
| `groundItemSnapshot(state)` | 投影快照 |

`apps/server/src/rooms/state.ts` 追加 `groundItems: GroundItemState[]`；
`apps/server/src/world.ts` 在 `startRoom` 调 `clearGroundItems`、在 `simulateRoom` 调
`advanceGroundItems`、在 objectiveDestroyed 处调 `createBreachDrop`、在 `useAction`
接丢弃/拾取动作，并把 `acquireOwnedItem` 作为回调注入（真人按连接解析 accountId，CPU 走本地）。
`apps/server/src/rooms/snapshot.ts` 投影 `groundItems`。

### 普通 input（最小扩展）

沿用 `MsgPlayerAction`，新增动作码：

| action | value | 语义 |
| --- | --- | --- |
| 1 | 0 | 拾取范围内最近的可领 ground |
| 2 | instanceId | 丢弃该 owned 实例 1 个到当前脚下 |

`World.useAction` 按连接解析认证玩家、`PLAYING`、`round` 后执行；接触拾取是默认路径，
action 只是同资格下的明确输入。丢弃每次 1 个；数量>1 由重复动作或后续扩展，不在此
臆造原包字段。CPU 走相同接触/action 路径，无账户时只写本轮本地库存。

### 事务顺序与失败保实体

丢弃：资格校验 → `discardOwnedItem` 成功 → 建 ground 实体 → 广播 `groundItemDropped`；
事务失败/类别无掉落行 → 不建实体、向本人回拒绝、库存不变。

拾取：资格校验 → `acquireOwnedItem` 成功 → 置实体 `claimed`、从列表移除 → 广播
`groundItemPickedUp`（及可选 `groundItemRemoved`）；失败/异常 → 清 `claimed`、实体保留、
不加库存、不广播取得。JS 单线程 + `node:sqlite` 同步执行保证「事务成功后才移除」。

### 时钟与生命周期

- 所有 `createdAt`、接触判定与清理使用现有 `World` 注入的 `now()`（true clock，毫秒）；
  绝不使用客户端 `clientTime` 做资格或到期判定。
- 开局（`startRoom`）清空 `groundItems` 并重置 id 计数；`OBJECTIVE`/`TIME_LIMIT` 终局后
  停止一切拾取；再战按上面清空重建，不恢复旧实体。
- 玩家 Leave 不回退已扣库存、不自动删除其 `'DISCARD'` 实体；实体保持可领到本轮结束。
  房间销毁/全员离开时随房间对象一并丢弃，不退库存。
- 中途加入者从快照看到当前实体；`FINISHED` 阶段 UI 不显示（与 `groundTraps` 一致）。

### renderer 复用原模型

新增 `apps/web/src/assets/scenes/ground-item-visual.ts` 与 `ground-items-presentation.ts`，
照 `ground-traps-presentation.ts`/`trap3003-visual.ts` 模式：

- 按 `modelId` 加载 `/Data/scnobj/<modelId>/<modelId>.glb`（`obj05001–obj05011` 均已发布）。
- `TransformNode` 用服务端矩阵/位置，套用 `applyCartoonOutlines`；mesh metadata 带
  `groundItemId`/`sourceModel`。
- `reconcile(snapshot.match?.groundItems ?? [], scope)` 按 `id` 增量创建/销毁；
  scope 变化或非 `PLAYING` 时 `clear()` dispose。
- `apps/web/src/match/battle.ts` 接入 reconcile，并消费 `groundItemDropped` 的即时表现与
  `groundItemPickedUp`/`groundItemRemoved` 的清理；渲染层不得改库存、不得据模型消失取得。

## 建议实施顺序

1. shared `GroundItemSnapshot`/事件字段 + state/snapshot 投影。
2. `drop-item-catalog.ts` 与 `ground-items.ts` 实体/资格/事务顺序。
3. `AccountStore.discardOwnedItem/acquireOwnedItem` 与 World 接线（Breach 掉落、丢弃、接触/action、清理）。
4. Web presentation 与 battle 事件接线。

先闭合 server 事务与身份，再接 UI；不新增 feature flag、migration、兼容层或未证原字段。

## 未实测与限制

- 本文是下一批实现合同，不是已实现或已验收结果；M2-10 未完成。
- 原服务端掉落概率、item→dropitem 行的逐物件选择、类别 6 拾取入账均未由现来源证明；
  0.5 概率、池 `{1,2}` 与「两位类别+一位档位」是明确采用规则。
- 3c96/3ca0 只部分反汇编确认字段与节点删除/生成调用；未执行完整函数，未证明所有可选回调递归无写入。
- 3caa/0x58 treasure record 未映射任何 owned 字段；treasure 入账不在本合同的 Breach 池内。
- 渲染加载、接触判定半径、CPU 本地拾取与端到端联机均待实现后实测，不能宣布完成。
