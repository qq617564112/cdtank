# Trade 非角色物品/装备候选行状态原来源

范围：UI61/M5-11。内容限定为原 Trade 页 `lstMyItem`（页面 `+0x120`）与 `lstMyEquip`（`+0x124`）
两条非角色候选名单的完整类别分派、行类、原状态 `1`（E）与 `4`（B）producer、动态更新与单槽删除，
以及现端 Inventory 投影采用边界。本方角色 OwnedTank/OwnedPet 的 N/B 与生命周期不在本页，
见 `trade-owned-row-status-source.md`。给出的是当前二进制可确认的有限静态事实，不替代运行时实测。

## 两条名单与分派入口

单选框点击处理 `4fc4f5` 以被点控件 `[arg+8]` 分派子页，压制判断 `[control+0x38c]!=0`：

| 子页控件 | 页面字段 | 列表工厂 | 列表控件 |
|---|---|---|---|
| `page+0xf8` | `[page+0xac]=0` | `4fb48a(0)` | `lstMyItem`（`+0x120`） |
| `page+0xfc` | `[page+0xac]=1` | `4fb48a(1)` | `lstMyItem` |
| `page+0x100` | `[page+0xac]=2` | `4fb48a(2)` | `lstMyItem` |
| `page+0x104` | `[page+0xa8]=0` | `4fb6fc(0)` | `lstMyEquip`（`+0x124`） |
| `page+0x108` | `[page+0xa8]=1` | `4fb6fc(1)` | `lstMyEquip` |
| `page+0x10c` | `[page+0xa8]=2` | `4fb6fc(2)` | `lstMyEquip` |

顶层页签字段 `[page+0xa4]` 有四个取值：`0` 宠物、`1` 战车、`2` 物品、`3` 装备
（由 `5019f5` 的 `0/1/else` 分支与 `4fab20` 的 `==2`/`==3` 分支共同确定）。

两条工厂都先把目标列表清空，再遍历 `[[0x633588]+0x120]`（当前角色对象）的分组成员容器，
对每项调用行构造并插入列表，随后按 `[MyItem]` 写行状态。

| 列表 | 工厂 | 行构造 | vtable | 状态成员 | setter |
|---|---|---|---|---|---|
| `lstMyItem` | `4fb48a` | `4b886d` | `0x5cee5c` | `+0x3c4` | `4bbcfd` |
| `lstMyEquip` | `4fb6fc` | `4b9e77` | `0x5ceee0` | `+0x3c4` | `4bbcfd` |

两个行构造都在初始化时把状态成员清 `0`：`4b88ed`（`MyItem`）与 `4b9ef7`（装备行）。setter
`4bbcfd` 只执行 `mov [row+0x3c4], eax`（`4bbcfd/4bbd01/4bbd07`）。`MyItem` 行与装备行共用
同一状态成员与 setter，draw 对 `1/2/3/4` 的落点分别为 `E`/`S`/`N`/`B`（原字符串对象
`0x5c192c`/`0x5cee70`/`0x5cee74`/`0x5c6410`，见 `home-role-equipment-row-status-source.md`）。
本页两条名单调用 setter 时只压入 `1`（E）或 `4`（B），不写 `2`/`3`。

### 分组成员容器与过滤

`lstMyItem` 工厂 `4fb48a` 依 `[ebp+8]` 取容器并对命中项调用 `43bd13`：

| 组 | 子页 | 容器 | 过滤 |
|---:|---|---|---|
| `0` | `rdoItem` | `role+0xc`（begin `+0x10`/end `+0x14`） | `43bd13==1` |
| `1` | `rdoWeapon` | `role+0x1c`（`+0x20`/`+0x24`） | `43bd13==3` 或 `==4` |
| `2` | `rdoValuable` | `role+0x6c`（`+0x70`/`+0x74`） | 无（容器即组） |

`lstMyItem` 在行构造前再要求 `[MyItem+0x10]>0`：`4fb5d6` 读 `[record+0x10]`，`4fb5dc` 在
`<=0` 时跳到整个工厂的收尾 `4fb6c1`。因此物品名单本身按 `ownedQuantity>0` 过滤，且遇
到 `0` 即结束本轮构建。

`lstMyEquip` 工厂 `4fb6fc` 依 `[ebp+8]` 取容器并对命中项调用 `43bd09`/`43bd13`：

| 组 | 子页 | 容器 | 过滤 |
|---:|---|---|---|
| `0` | `rdoCommon` | `role+0x5c`（`+0x60`/`+0x64`） | `43bd09==5` |
| `1` | `rdoHat` | `role+0x2c`（`+0x30`/`+0x34`） | `43bd13==5` 或 `==6` |
| `2` | `rdoMark` | `role+0x3c`（`+0x40`/`+0x44`） | `43bd13==7` |

装备名单工厂在行构造前后没有 `[MyItem+0x10]` 数量判定，四个 setter 段只判状态成员与
目录命中。

## 分类 getter、ItemID 区间与 kind 数字

原类别分派只有两个 getter，都读 `[MyItem+0xc]`（`itemTableId`）：

- `43bd09` → `4396e0(itemTableId)`：粗分派，返回 `1..7`。
- `43bd13` → `439762(itemTableId)`：细分派/快捷分派，返回 `1..17`。

`4396e0` 的区间与返回值：

| 返回 | ItemID 区间 |
|---:|---|
| `1` | `1..1000` |
| `2` | `2001..4000` |
| `3` | `10001..12000` |
| `4` | `12001..13000` |
| `5` | `13001..18000` |
| `6` | `20001..22000` |
| `7` | `30001..33000` |
| `0` | 其它（含 `1001..2000` 空档） |

`439762` 的区间与返回值（现端 `item-hotkeys.ts` 的 `classifyItemId` 与之逐段一致）：

| 返回 | ItemID 区间 |
|---:|---|
| `1..4` | `1..1000`/`1001..2000`/`2001..3000`/`3001..4000`（每千一段） |
| `5..12` | `10001..18000`（每千一段） |
| `13..14` | `20001..21000`、`21001..22000` |
| `15..17` | `30001..31000`、`31001..32000`、`32001..33000` |
| `0` | 其它空档 |

`43bce7([MyItem])` 是堆叠判定：`itemTableId` 在 `1..4000` 或 `20001..21000` 时返回 `1`，
其余返回 `0`（`43bce7..43bd08`）。该判定用于候选加入分支，与 `43bd09`/`43bd13` 相互独立。

### 草稿表 kind 与 offer kind

SHOW 构造 `5019f5` 的非堆叠分支 `501d07` 把记录的 `43bd09` 映射为草稿表 kind 并写
`page+0x140` 行 `+0`：`43bd09==3→4`、`==4→5`、`==5→6`、`==6→7`、`==7→8`（`501d2e` 起）。
堆叠数量分支 `500a43` 另行按 `[page+0xac]` 写 kind：`==0→2`、`==1→3`（`500a60` 起）。

SHOW 构造 `502aab` 再按草稿行 `+0` 分派：`0` 宠物、`1` 战车、`2/3` 经 `43bcb5` 新建
`0x30` 记录（把 `+4/+8/+c` 复制自 `43d186` 命中记录，并把草稿行 `+4` 写入新记录 `+0x10`
作为提供数量）、`4..8` 取 `43d728` 命中的原拥有记录；`>8` 跳过。offer writer `49328d`
同样按条目 `+8`：`0` 宠物 writer `41e42e`、`1` 战车 writer `42195e`、`2..8` 物品 writer
`42dddd`，随后写 money32/originality16/skillPoints16。两者一致，草稿 kind 即 offer kind。

据此，本页物品/装备的 kind 数字为：

| kind | 来源 | ItemID 区间 | 现端子页 |
|---:|---|---|---|
| `2` | 堆叠，`[page+0xac]==0` | `1..1000` | `rdoItem`（道具） |
| `3` | 堆叠，`[page+0xac]==1` | `2001..4000` | `rdoWeapon`（武器） |
| `4` | `43bd09+1`（`43bd09==3`） | `10001..12000` | `rdoHat`（帽子/气球） |
| `5` | `43bd09+1`（`==4`） | `12001..13000` | `rdoMark`（标志） |
| `6` | `43bd09+1`（`==5`） | `13001..18000` | `rdoCommon`（零件） |
| `7` | `43bd09+1`（`==6`） | `20001..22000` | `rdoValuable`（贵重品） |
| `8` | `43bd09+1`（`==7`） | `30001..33000` | 无恢复组 |

`43bd09==7`（`30001..33000`）与 `43bd13∈{13,14}`、`{15,16,17}` 不出现在已恢复的任一
装备组过滤条件中；`rdoCommon` 的过滤是 `43bd09==5`，不接受该类。原装备名单没有
`kind 8` 的接收组。

## 行状态 1（E）与 4（B）

两个工厂在插入行后读该记录的状态字段，E 判定统一在 B 判定之前：

```text
if [MyItem+0x1c] == 2:
    setter(row, 1)          ; E
else:
    <目录命中判定>
```

命中判定的共享函数是 `4fa1ff(page, kind, instance)`（`4fa1ff..4fa21e`）。它从槽 `0` 起按
`0x14` 步长扫 12 项，比较 `page+0x140+0x14k` 的 `+0`（kind）与 `page+0x148+0x14k`
（instance）。命中即返回 `1`，否则返回 `0`。E 分支命中后直接 `push 1`，不再进入 `4fa1ff`；
B 分支命中后才 `push 4` 并调用 setter。因此 E 优先于 B，同一候选不会同时点亮两者。

各名单调用的目录 kind：

| 名单 | 组 | 目录判定 | 命中写 |
|---|---|---|---|
| `lstMyItem` | `0/1/2` 共用 | `4fa1ff(page,2,inst)`，再 `3`，再 `7` | `4`（首个命中） |
| `lstMyEquip` | `0` `rdoCommon` | `4fa1ff(page,4,inst)` | `4` |
| `lstMyEquip` | `1` `rdoHat` | `4fa1ff(page,4,inst)` | `4` |
| `lstMyEquip` | `2` `rdoMark` | `4fa1ff(page,5,inst)` | `4` |

`lstMyItem` 的三个 kind `2/3/7` 与物品子页的草稿 kind 一致。装备组中 `rdoHat`（`43bd13∈
{5,6}`→kind `4`）与 `rdoMark`（`43bd13==7`→kind `5`）自洽；`rdoCommon`（`43bd09==5`，
草稿 kind 应为 `6`）却按 `4fa1ff(page,4,inst)` 判定，与草稿 kind 表不符。该分支的
`push 4`（`4fbc26`）是原二进制字面值，见 Known Issues。

E 的 per-role producer 不在本页：原查询结果处理 `43ed18` 只对当前角色分组标记写
`[MyItem+0x1c]=2`。现端共享实现是 `apps/shared/combat/inventory-query.ts` 的
`applyInventoryQuery(groups, records, role)`，用 `role.field44`/`field45`/`array1`/`array2`
分别对分组 `2`（`43bd09==3`）、`3`（`==4`）、`5`（`==5`）调 `markEquipped`，把命中记录的
`state` 写 `2`。该 producer 只覆盖装备类（cats `3/4/5`），物品类（cats `1/2/6/7`）保持 `state 0`。

## 动态更新 setter 与单槽删除

- 加入 `5019f5(slot)`：先以 `50197a(instance)` 判重，已存在即返回不变；否则按容器取记录写
  草稿行（pet `kind 0`/tank `kind 1`/物品按 `43bd09+1` 或 `2/3`）。写完后对手点候选行调
  setter 写 `4`；setter 依 `[page+0xa4]`：`0→4bd103`（宠物）、`1→4bbcfd`、其余（含
  `2/3`）`→4bbcfd`（`501dee/501dfa/501e01`）。
- 数量更新 `500a43(slot)`：复核空槽与 `[page+0xac]` 后写 `kind 2/3`，并对 `[page+0x120]`
  当前行调 setter 写 `4`（`500b7c/500b88/500b8f`），接收者是 `lstMyItem` 的当前行。
- 单槽删除 `4fab20(page, slot)`：在 `[page+0x20]==0` 时按草稿行 kind 分支扫描对应列表
  （pet/tank 扫 `[page+0x11c]`；物品 cats `1/2/6` 扫 `[page+0x120]`，装备 cats `3/4/5/7`
  在 `[page+0xa4]==3` 时扫 `[page+0x124]`），把 instance 匹配的行 setter 写 `0`，再调
  `4f93ce(page, slot)`。
- `4f93ce(page, slot)` 清单槽：草稿行 `+0=0xc`、`+4=0`、`+8=0`、`+0xc=0`、`+0x10=0`，并
  重置对应槽控件与详情文本。`0xc` 大于 SHOW 接受范围，故清空槽被 SHOW 跳过。
- 点击派发 `4fae0c` 在 `byte[page+0x20]==0` 时，从 `page+0x458` 与 `page+0x488` 两组各 12 个
  槽控件指针里找出被点控件对应的槽号，再调 `4fab20(page, slot)`；门禁对象是 page，不是被点
  control。整表清空与撤回保留沿用 `4fcbe9`/`4fc495`（见
  `trade-owned-row-status-source.md`）。

## 当前确认 profile 投影与采用合同

### 原 fact

- 本方 B 的唯一来源是原本方 12 草稿表 `page+0x140` 的 `(kind, instance)` 成员关系
  （`4fa1ff`）；不是选中背景、`party.confirmed`、peer 记录或角色 N。
- E 的唯一来源是当前角色记录标记 `[MyItem+0x1c]==2`；当前角色 C 类（cat `3/4/5`）由
  原查询/装备链写，物品类不写。
- 物品名单按 `ownedQuantity>0` 过滤；装备名单无数量 gate。
- E 优先于 B。

### 现 mapping

`PtlTrade.TradeAccount` 经 `AccountTrade.account()`（`apps/server/src/accounts/trade.ts`）已带：

- `profile.bytes`：原角色 368 字节资料，含战车选择 `+0xa8`、宠物选择 `+0xa4`。
- `owned.base`/`owned.equipment`：原拥有记录（base key `+0`、equipment key `+0x1c`）。
- `inventory.records`：原库存记录（含持久位 `state`）与 `float24Bits/float28Bits/float2cBits`。
- `inventory.hotkeys`：长度 7 的快捷槽实例 ID。

现端 profile 的装备槽（`apps/server/src/accounts/profile/equipment.ts`、`cosmetics.ts`）：

- 5 部件槽 `+0x148 + 4*slot`（`0..4`），由 `AccountTankEquipment.project` 按当前战车
  `tank_equipment` binding 写。
- 装饰/皮肤 `+0x118`；标志 `+0x13c`。

由此给出本次采用规则：

1. E（当前角色）是纯投影：候选 `instanceId` 命中当前 `profile.bytes` 的 5 部件槽或
   `+0x118`/`+0x13c` 即 E。这等价于原 `[MyItem+0x1c]==2` 对当前角色的 per-role 标记
   （`field44`/`field45`/`array1`/`array2`）。**不得**用
   `account.inventory.records[].state===2`：`AccountStore.saveEquipment` 与
   `AccountTankEquipment` 的 `installed` 集合是账户级（任意战车），不是当前角色。
2. B 是 `draft.records.some(ref => ref.kind===kind && ref.instanceId===instanceId)` 的成员关
   系，`draft.records` 是唯一 B 来源；行身份用现端 `TradeRecordView.kind`（`pet`/`tank`/
   `item`）+ `instanceId`，不使用选中、`party.confirmed` 或 peer 记录。
3. 原 kind 数字与现 `TradeRecordView.kind` 是两个层面：B/N/选中以 `kind`+`instanceId`
   稳定身份为准，`category`/`itemTableId` 只用于分派子页与判定可堆叠，不替代身份。
4. 物品名单的 `ownedQuantity>0` 过滤是原事实；装备名单不据此 gate。
5. 不给非角色行造 S（`2`）或 N（`3`）；未知状态保持无。
6. E 判定不要附加 `OWNEDqty>0` 或支付/费用 gate。

现端已接生产的数据入口是每次 render 读取同一确认 `state.account.profile.bytes`，B 走既有
本地 `draft.records`；不新增独立 query、cache、API、schema、poll、费用或取得。消费者没有
`profile.bytes`、bytes 短于字段或字段不命中时直接不画对应标识，不另发 `Equipment` QUERY
或其它 fallback，也不由 selected、`bindingName`、`state===2`、peer 或数量 gate 补值。

### 未知原 authorization

原服务端对 `3f9e`/`3fa1`/`3fa2` 的资格、失败与事务字段，以及 12 草稿表的服务端校验，
不在本来源内。Web 的权威状态来自现有重建服务；本条只限定客户端行状态来源。

## 当前生产接线

本页非角色候选状态已接生产：

- 物品子页（`rdoItem`/`rdoWeapon`/`rdoValuable`）与装备子页（`rdoCommon`/`rdoHat`/
  `rdoMark`）继续复用 `apps/web/src/interface/account/trade-source-page.tsx` 的候选筛选与
  `trade-candidate-row-content.tsx` 的行内容。
- `trade-candidate-row-content.tsx`：`kind==='item'` 行在 `current`（E，来自同一确认 profile
  投影）与 `offered`（B，来自 `draft.records`）命中时渲染状态 glyph；E 优先，`!current && offered`
  才画 B。`kind==='tank'/'pet'` 沿用既有 N/B。
- glyph 直接复用既有共享 `HomeRoleRowStatusBadge` 与 `SmallHT` 资源（E=`e.tga` /
  `ui/regions/11/9.png`，B=`b.tga` / `ui/regions/11/8.png`），几何沿用 Trade 作用域
  `point (5,8)`、14×14；`installed`/`offered` refs 已在共享 consumer 中存在，无新增 mapping。
- 生产入口为 `trade-source-page.tsx` 与 `trade-candidate-row-content.tsx`。必要依赖：
  `apps/shared/combat/inventory-query.ts`（`classifyInventoryCategory` 与 per-role 等价）、
  `apps/server/src/accounts/trade.ts`/`profile/equipment.ts`/`profile/cosmetics.ts`
  （`profile.bytes` 装备槽）、`apps/shared/protocols/PtlTrade.ts`。

## Known Issues

- `rdoCommon` 组按 `4fa1ff(page,4,inst)` 判定 B，与草稿 kind 表（cat `5`→kind `6`）不符；
  该处 `push 4`（`4fbc26`）为原二进制字面值，未据名称回推，运行时该组合法 B 需实测确认。
- `43bd09==7`（`30001..33000`，草稿 kind `8`）与 `43bd13∈{13,14}`（cat `6`）、
  `{15,16,17}`（cat `7`）不出现在任一装备组过滤中；现端把 cat `7` 归入 `rdoCommon` 子页
  无已恢复工厂依据。
- 现端 `applyInventoryQuery` 的 per-role bindings（`field44`/`field45`/`array1`/`array2`）
  在 `AccountStore.assign` 之外没有真实调用点；Trade 的 E 采用 `profile.bytes` 装备槽纯投影
  而非该函数，两者对当前角色等价，但未在同一调用链实测。
- `inventory.records[].state` 是账户级安装标记（`AccountTankEquipment` bindings 全账户），
  不是当前角色 E；直接采用会点亮装在其它战车上的物件。
- 原单槽删除的 UI 触发（`4fae0c`/`4fab20`）在 `byte[page+0x20]==0` 后从 `page+0x458` 与
  `page+0x488` 两组槽控件指针反查槽号，逐控件→槽号映射未确认；`4f93ce` 的清零字段
  （`0xc`/`0`）已确认。
- 原服务端授权、`3f9e`/`3fa1`/`3fa2`/结算失败字段与事务不属本来源；Web 权威状态来自现有
  重建服务。
- 本来源是有限静态结论，未做运行时、浏览器或 HD 实测，不称原交易流程、导出或持久化完成。
