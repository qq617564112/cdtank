# 地面掉落与拾取业务合同

M2-10 掉落子项。本文定义原客户端地面物件通信已证明的事实、当前已接的 server/shared/UI
函数、字段与事务顺序，以及为可实施而采用的业务规则。采用规则不冒称原 Windows 服务端
逐行为复刻。

覆盖消息：`UMsgDiscardItem`(0x3c96/441155)、`UMsgPickupItem`(0x3c98/441382)、
`UMsgPickupTreasure`(0x3caa/44162c)、`UMsgDeleteGroundItem`(0x3ca0/441e13)，
以及同族的 `UMsgDiscardTreasure`(0x3ca9/44233c)、`UMsgDeleteTreasure`(0x3cab/43dab8)。

## 来源事实

### 具名 receiver 只做场景清除

`442595` 用 `43c228` 绑定 `441382`，名称 `5c5734 UMsgPickupItem`；`4425d7` 用 `43c266`
绑定 `44162c`，名称 `5c5720 UMsgPickupTreasure`；二者是库存管理器 `4423ae` 注册的两个
成功通知，不拥有表也不承接消费入口。完整虚表、包体指令与两个 receiver 的反汇编见
[来源索引](../output/ground-pickup-receiver-source.json)。

| 消息 | 包体（读序） | receiver 行为 |
| --- | --- | --- |
| UMsgPickupItem 3c98 | 16位 itemTableId(+c)、32位 field10(+10)、f32 x(+14)、f32 z(+18)、1位 success(+1c)，共 113 位 | success 非零、ItemTable(fieldC) 可查、场景 provider 存在才继续 |
| UMsgPickupTreasure 3caa | 1位 success(+14)、32位 field10(+10)，success 后再经 `41da1d/41dad0` 写读一条 0x58 嵌套记录 | success 非零、场景 provider 与 manager+a8 树节点坐标匹配才继续 |

- `441382` 遍历 manager+0x9c 场景树，按被引用 Itemrecord+0xc 与 `+0x14/+0x18` 坐标窗口
  匹配，`4595f9` 移除模型、`457ca0` 刷新、可选 `+0xc0` 观察器、`43cdd8`/`43c9e5`
  释放并 erase 节点。
- `44162c` 遍历 manager+0xa8 场景树，按节点 `+0x48/+0x50` 坐标匹配，两个模型名分别交
  `4595f9` 移除，之后 `457ca0` 刷新、可选 `+0xc0` 回调、`43ce02`/`43c9e5` 释放并 erase。
- 坐标窗口常量 `0x5c1550` 是 double `0.001`；比较为 `|node - packet| <= 0.001`，
  即成功通知回显生成位置，不是玩家接触半径。
- `field10` 与 `413f60` 比较仅控制本机提示/声音；远端成功通知仍执行场景移除。
- 两个 receiver 都没有直接调用 `43d583`/`43d122`/`440fd7`，都没有写 MyItem 数量，
  都没有直接改账户库存。它们可见的合同就是「成功后清除场景节点」。

因此模型消失不等于取得库存；库存写入必须由重建服务端在持久事务里完成。

### 丢弃与删除地面物件的原指令

以下为直接读取原 PE 字节得到的部分反汇编（`CDTank.exe`，ImageBase 0x400000），
只描述已确认的字段和调用。

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
  它们不解码拥有库存字段。

### Treasure 0x58 与 MyItem 0x30 是不同身份

`43fe8b` 在 success 时分配 0x58 字节记录并由 `41dad0` 读入；`41da1d` 写序为
`+0(8位)、+4(24位)、+8(16位)、+0xc(16位)、+0x10(字符串)、+0x48(32位)、+0x4c(32位)、+0x50(32位)、+0x54(16位)`。
这与共同库存记录 `InventoryWireRecord`（MyItem，0x30 字节，`instanceId/itemTableId/ownedQuantity/
battleQuantity/state/float 原位`，见 `apps/shared/protocols/PtlInventory.ts` 与
`inventory-wire.md`）不是同一身份。0x58 嵌套记录的 `+4` 等字段不得当作拥有实例 ID 或
库存量，也不得据此写任意 owned 字段。

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

可判定事实：该表是类别→地面模型/贴图/声音/特效表；`ItemID` 是场景模型
`obj05001–obj05011`，`EffectFile` 全是已发布效果 44，`ItemTexture` 为 A/B，
`SoundFile` 为已发布 GA21–GA28。表不含 ItemTable ID、概率、货币、经验或账户奖励字段。
`Min/Max` 是递增数值区间，用于在类别内选择档位。

贴图不是「同目录默认 GLB」：`obj05008.glb` 内建贴图是 B 变体（`obj05008B.png`），
A 变体是 `obj05014A.png`，不存在 `obj05008A.png`；`obj05006` A/B 为
`obj05006A.png`/`obj05006B.png`（GLB 内建 B），`obj05007` A/B 为
`obj05007A.png`/`obj05007B.png`（GLB 内建 A）。因此渲染必须按 (modelId, texture) 查显式
贴图映射，A/B 档位落到正确变体。

### 类别6的写入来源边界

现来源中类别 6（20001–22000）的写入只有出售路径：`495e90` kind5 → `494bad(instance,quantity)`
→ 成功后 `495591` 调 `43d583(instance,replyquantity,6)`、`43d122` 扣 MyItem+10 或释放实例，
见 `valuable-item-sale-contract.md`。没有已恢复来源证明类别 6 的增加。类别 6 的拾取入账
因此是采用规则，必须走现 inventory 持久 schema，不得由 0x58 treasure record 反推。

## 采用业务规则

### 地面实体

新增服务器权威实体 `GroundItemState`，客户端只读投影 `GroundItemSnapshot`：

| 字段 | 语义 |
| --- | --- |
| `id` | 稳定身份 `${runId}:${roomId}:${round}:G${counter}`；`runId` 是服务端进程启动随机 UUID，`counter` 每轮单调 |
| `itemTableId` | 合法 ItemTable ID |
| `quantity` | 正整数，本次掉落数量 |
| `modelId`/`texture`/`soundId`/`effectId` | 由 `dropitem` 行选定 |
| `x`/`y`/`z` | 服务端权威位置（Breach 用源矩阵，丢弃用玩家当前位） |
| `source` | `'BREACH'` 或 `'DISCARD'` |
| `ownerId?` | 击毁者或丢弃者，信息用途 |
| `createdAt` | 服务端注入 `now()`（`Date.now`）毫秒 |

实体本轮不移动、不自动重生，被领取或本轮结束即消失。

### dropitem 档位选择

采用规则：把 `ItemType` 解释为 `<两位类别><一位档位>`；两位类别对应
`classifyInventoryCategory` 的 1..6，档位按 `Min <= quantity <= Max`。类别 7 无掉落行。

类别 2 的档位存在边界重叠：`021`(1–5) 与 `022`(5–9) 在 quantity 5 同时命中。采用固定
规则：按表内出现顺序取首个匹配行，即 quantity 5 走 `021`→`obj05008`。丢弃时若某
`itemTableId` 的类别无掉落行、或该 (modelId, texture) 无贴图资源，则拒绝丢弃、不扣库存。

### 掉落池与概率

- 触发：模式 5 DESTROY 目标 HP>0 转 0 的既存 `objectiveDestroyed` 权威事件。
- 概率：每次摧毁从服务端 RNG 取 `[0,1)` 均匀值，小于 `0.5` 时掉落；原服务端概率未取得，
  0.5 是采用值，不猜原概率。
- 池：`{itemTableId 1, itemTableId 2, itemTableId 2010, itemTableId 20001, itemTableId 20002}`，各 quantity 1，
  等概率。类别 1/2 已有持久 schema 与普通使用/治疗闭环（`healing-item-runtime.md`）；
  类别 6 是贵重品，拾取写 owned 库存，效用由物品自身技能链在普通使用路径产生。
- 目标 HP 与生命来源仍取自 mode 合同（`DefaultButt`/`ButtReborn`），掉落在 HP 归零的
  同一批 M 事件内生成，不改写源 HP。

### 类别6物品的合法构造

20001/20002 的拾取入账用现 `InventoryWireRecord`/`BattleItemRecord` 真实类型构造：
`itemTableId` 取自表（20001/20002），`ownedQuantity` 为累加后的正数，`battleQuantity` 为本轮
可用数，`state/field8/float*` 保持原位默认。不得伪造 0x58/0x30 raw 或未知字段。取得后仅
授予库存，后续普通使用不是免费 Shop，仍按现有 item-use/healing 规则消耗。

### 拾取资格与触发

服务端在 `PLAYING` 内解析，任一条件不满足则保实体、不扣不加：

1. 同房间、同 `round`、实体未被领取。
2. 正常玩家接触：玩家服务端坐标与实体距离 `<= GROUND_PICKUP_RADIUS`（采用值 40 世界单位，
   与 `BODY_RADIUS=20` 同体系）。
3. 认证活体：真人需有 `accountByConnection` 绑定；CPU 无账户。
4. 距离与存活以服务端状态为准，不使用 `MsgPlayerInput.clientTime`。

普通接触即可完成拾取，不要求显式拾取 input。当前协议只有 `MsgPlayerAction` 的数字 action，
且没有已证 1/2 旧业务可借；丢弃使用最小新增 typed action：`action=100` 表示丢弃当前选中
合法库存实例一份，必须带 room/round 资格。client 不直接改 inventory。

CPU 走同一接触扫描与资格：普通移动真接触，沿同资格在本轮 local 库存取得有限 quantity，
但不写账户 grant，也不自动写 HP；无自动 gift。

### 事务、receipt 与不复制价值

- Acquire 用稳定键 `(roomId, round, groundId, accountId)` 记 receipt，服务端账户事务成功
  后重放不双加；同一 ground 只能被一个 account 取走。键由现有 room/round/groundId 组成，
  不引入哈希或额外昂贵操作。
- Discard 用同一 groundId 绑定一份 `expectedQuantity`；事务失败不留实体、不改库存，成功
  扣量后才生成 ground。receipt 同步做 typed 清理：删除实例时清持久 hotkey（沿用现有
  `DELETE FROM hotkeys`），本局量相应清，避免对已删除实例留下悬空绑定。
- `'DISCARD'` 先由账户事务从原实例扣出 `quantity`，再作为 ground 存在；本人重拾只加回
  `quantity`，不复制出第二份。他人拾取由 receipt 保证同一 ground 只入账一次。
- `'BREACH'` 不从任何账户扣，拾取是净取得；目标重生只恢复目标，不重放已领取实体或掉落。
- `GROUND` 计数身份由服务端 run UUID + room + round 组成，客户端不参与身份或哈希计算。

### owned 与战斗库存同步

拾取把 owned 写入后必须让本局可用数可达，不能只持久 add 而 `battleQuantity` 永远为 0：

- 已有实例：`ownedQuantity += quantity`，保留该行原 `state/slots/float/字段`。两贵重品
  `20001/20002` 在本角色七槽中时按采用规则取真实剩余 `ownedQuantity` 作为本局可用数；
  其它原物件仍按 `min(ownedQuantity, max(0, BattleUseMax - roundUse))`，已消费的本局数量
  由 `roundUse` 计入，`ownedQuantity` 已反映真实扣量，本局可用数不再二次扣减。
- 新实例：按现未用 uint32 语义分配 instanceId 建 owned 记录，不自动改用户槽位；玩家
  正常配置槽位或再战时通过既有 Kitbag/再战流程选择。
- 同账户多连接：用现 `refreshAccountTitle` 同型机制把 owned/本局量广播给该 account 的
  全部在房角色，及时更新，不遗留旧数量。

### 效用

- 拾取一律写 owned 库存，是唯一取得作者，不在拾取时写 HP。
- HP/治疗等效果由该物件已恢复的普通使用路径产生（类别 1 走 `applyHealingItem`；
  `20001/20002` 的 Func20 只做拾取数量入账，普通 use 走 `ItemSkill2=30005`），沿用现
  `dispatchItemHotkey`/`apply*` 事务与数量消耗。
- `20001/20002` 成功普通使用先在同一 AccountStore CAS 事务按真实 owned 消费一份，再治疗并
  各减一；最后一份归零时同事务删空实例及所有引用快捷槽，成功后清当前角色零量记录、
  七快捷槽与数组 0 权威。其它物件保持原零量 UPDATE 行为。成功 `itemUsed` 带
  `definition.name` 沿现 HUD。
- CPU 真实 CONFIGURE 只接受精确 `20001/20002` 到消耗槽 5..8；源 `BattleUseMax=0` 保持，
  正有限 uint32 是库存表示界而非每轮上限，不自动分配、不赠送未配置实例。
- 类别 6 贵重品不进入 0x58 treasure 记录映射；其入账只走 known itemTableId + 现 schema。

### 生命周期与终局顺序

- 开局 `startRoom` 调 `clearGroundItems` 并重置 counter；`OBJECTIVE`/`TIME_LIMIT` 终局后
  停止拾取。
- 同一批次 M 内：先按伤害结算 DESTROY 与 `objectiveDestroyed`，并在 HP 归零的同一批
  创建 drop 事件，再判全清/终局。`finishRoom` 只冻结结算与清状态，不再继续拾取。
- 目标 `ButtReborn` 重生恢复 HP，不重放掉落、不恢复已领取实体。
- 换轮 `clearGroundItems` 与玩家 Leave 删除其 ground 时不向 source owner 退款：
  `'DISCARD'` 已扣的库存不返还，`'BREACH'` 本无扣。

## 接口与实现

以下 server/shared/UI 契约均已落地：shared 契约与投影由 83f138f 提交，domain 由 fda9ebb
接入，账户事务由 be579f9 接入，World 生产桥由 88b726a 接入，Web 呈现由 fc83778 接入。

### shared 协议（当前实际版本 106）

现 `apps/shared/protocols/serviceProto.ts` 的版本为 106。本子项在版本 105 基础上加 1，
新增类型/字段沿用既有 field 结构，不改动任何旧 ID 或旧字段语义。

`apps/shared/protocols/MsgRoomSnapshot.ts`：

```ts
export interface GroundItemSnapshot {
  id: string;
  itemTableId: number;
  quantity: number;
  modelId: string;   // 'obj05001'..'obj05011'
  texture: 'A' | 'B';
  soundId: string;   // 'GA21'..'GA28'
  effectId: string;  // '44'
  x: number; y: number; z: number;
  source: 'BREACH' | 'DISCARD';
  ownerId?: string;
  createdAt: number;
}
```

`MatchSnapshot` 追加可选 `groundItems?: GroundItemSnapshot[]`，与既有 `groundTraps?` 同形，
旧 fixture 可省略。`apps/shared/protocols/MsgRoomEvent.ts` 复用现有信封，最小追加：

```ts
groundItemDropped?: GroundItemSnapshot;
groundItemPickedUp?: {id: string; playerId: string; itemTableId: number; quantity: number};
groundItemRemoved?: {id: string};
```

### server

- 新增 `apps/server/src/battle/items/drop-item-catalog.ts`：读
  `sourceTablePath('dropitem')`，导出 `selectDropVisual(itemTableId, quantity):
  {modelId; texture; soundId; effectId} | undefined`，按上表固定档位（含边界取首行）。
- 新增 `apps/server/src/battle/items/ground-items.ts`：
  `createBreachDrop`、`discardToGround`、`advanceGroundItems`（服务端接触扫描）、
  `pickupGroundItem`、`clearGroundItems`、`groundItemSnapshot`。
- `apps/server/src/account-store.ts` 新增（沿用现 `BEGIN IMMEDIATE`/`COMMIT`/`ROLLBACK`、
  `inventory` 表与 `InventoryWireRecord`）：
  `discardOwnedItem(accountId, instanceId, expectedQuantity, itemTableId)`（单事务扣量、
  归零删行并清 hotkey）、`acquireOwnedItem(accountId, itemTableId, quantity, receipt)`
  （按 receipt 幂等，累加或新实例）。
- `apps/server/src/rooms/state.ts` 追加 `groundItems: GroundItemState[]`；
  `world.ts` 在 `startRoom` 清、`simulateRoom` 扫接触、objectiveDestroyed 建 Breach 掉落、
  `useAction(action=100)` 丢弃、注入 acquire/discard 回调；`rooms/snapshot.ts` 投影。

### UI

新增 `apps/web/src/assets/scenes/ground-item-visual.ts` 与 `ground-items-presentation.ts`，
照 `ground-traps-presentation.ts`/`trap3003-visual.ts`：按 (modelId, texture) 映射加载正确
GLB 与 PNG 变体（如 `obj05008`+A→`obj05014A.png`），套 `applyCartoonOutlines`，
metadata 带 `groundItemId`/`sourceModel`；`reconcile(snapshot.match?.groundItems ?? [], scope)`
按 `id` 增量创建/销毁，scope 变化或非 `PLAYING` 时 `clear()` dispose。
`apps/web/src/match/battle.ts` 消费 `groundItemDropped/PickedUp/Removed`，渲染层不改库存。

## Known Issues

- 原服务端掉落概率未证；0.5、池 `{1,2,2010,20001,20002}`、dropitem 档位解释（含边界取首行）
  均为采用规则。
- 两贵重品 `20001/20002` 的拾取入账无原服务端 writer，采用 Func20 持久加一；
  采用规则对两精确 ID 按真实 owned 暴露可用量，不扩展 category6 全类；普通 use 不再
  加一，`ItemSkill2=30005` 只做一次 AccountStore CAS 后治疗并各减一，最后一份同事务
  删实例与引用快捷槽，非免费 Shop。CPU 配置只对这两个精确 ID 走 CONFIGURE 消耗槽
  5..8，数量界沿用正有限 uint32，不新增每轮上限。
- 3c96/3ca0 只部分反汇编确认字段与节点删除/生成调用；3caa 0x58 记录未映射任何 owned 字段。
- 接触半径40、CPU 本地拾取、同账户多连接库存广播与前端贴图变体均已实现；实际对局、
  双端、持久与高清验收未做，M2-10 未完成。
