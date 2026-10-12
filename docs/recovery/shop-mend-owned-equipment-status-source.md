# 商城与维修中心拥有部件行状态原来源

范围：UI55/UI54/M5-10。内容限定为原 `ShopEquipPage` 的拥有/可售部件名单，以及原
`ShopMendPage/lstPart` 的拥有部件名单，恢复其行类、状态成员、状态 producer、
当前角色条件和当前只读数据采用。原 `OwnedTank`/`OwnedPet` 构造状态 `0` 的结论保持
不变，不在此重做。

## 原 `ShopMendPage/lstPart`

原 `ShopMendPage` 的拥有部件列表是对象 `+0x5c`。事件入口 `5197c5`、`5197ea`、
`519807` 分别比较被点控件与页面 `+0x4c`、`+0x50`、`+0x54`，并以参数 `0`、`1`、
`2` 调用建立入口 `518f8a`：

| 参数 | 分支 | 当前角色分组 | 分类条件 | 列表 |
|---:|---|---|---|---|
| `0` | `5193d1` Common | `[0x633588]+0x120`，`+0x5c` | `43bd09 == 5` | `[page+0x5c]` |
| `1` | `5191ce` Hat/Balloon | 同当前角色，`+0x2c` | `43bd09 == 3` | `[page+0x5c]` |
| `2` | `518fb5` Mark | 同当前角色，`+0x3c` | `43bd09 == 4` | `[page+0x5c]` |

三支在重建前清空同一列表，名称、类别、天数分别由 `4d8366`、`4d83b3`、`4d849e`
生成，再以 `4b9e77` 建立 `161x56` 行，vtable 为 `5ceee0`。构造在 `4b9eab` 写
vtable，并在 `4b9ef7` 将状态成员 `[row+0x3c4]` 清 `0`。

每支的实际状态 producer 相同：读取当前实例 `[MyItem+0x1c]`，只有等于 `2` 时压入
`1` 并调用 setter `4bbcfd`；setter `4bbcfd/4bbd01` 只执行
`mov [ecx+0x3c4], eax`。分类、当前角色分组和该比较之外，没有数量、槽位或维修资格门禁。
因此本列表原状态在该链中只可达 `0` 或 `1`。

行 draw 从 `4ba194` 开始。`4ba258..4ba273` 在行局部坐标 `(x+5, y+8)` 建立状态绘制点；
`4ba4d1` 检查 `[row+0x3c8]` 字体，`4ba501` 读取 `[row+0x3c4]`。状态 `1` 分支为
`4ba6f7`，原字符串对象 `0x5c192c` 的值是 `E`，经 `CEGUI::Font::drawText`
(`[0x5c02d8]`) 绘制。构造在 `4ba11c..4ba146` 从 `0x5cedf4` 取 `SmallHT`
并写入 `[row+0x3c8]`。`SmallHT` 的 `e.tga` 资源以及 `14x14` 尺寸沿用原字体资源确认；
这不是 Shop 拥有页另一行类 `5ceef8` 的属性。

draw 中状态 `2`、`3`、`4` 分别落在 `4ba65c`、`4ba5c1`、`4ba526` 的 `S/N/B`
分支，但 `518f8a` 及其三个分类分支只产生 `1`，没有本页 producer 将这三种状态写入本行类。

## 原 `ShopEquipPage`

### 拥有列表 `lstMyEquip`

拥有列表是页面对象 `+0x48`，三个工厂分别写同一列表：

| 分类 | 工厂 | 数据范围与过滤 | 行 |
|---|---|---|---|
| Common | `515410` | 当前角色 `+0x5c`，`43bd09 == 5` | `4ba7df` |
| Hat/Balloon | `515684` | 当前角色 `+0x2c`；由 `MyItem+0xc` 查 ItemTable 后 `439762 == 5` | `4ba7df` |
| Mark | `515912` | 当前角色 `+0x3c`；由 `MyItem+0xc` 查 ItemTable 后 `439762 == 7` | `4ba7df` |

`4ba7df` 在 `4ba813` 写 vtable `5ceef8`，并在 `4ba87e` 将状态成员
`[row+0x4ec]` 清 `0`。三个拥有工厂在行加入列表后检查 `[MyItem+0x1c] == 2`；
命中时调用 `4bc85e`，该 setter 只写 `[ecx+0x4ec] = eax`。工厂压入的值是 `1`，
因此原拥有列表只产生状态 `0/1`。

本行类的 draw 是 `4bac37`。`4bad42` 只比较 `[row+0x4ec]` 是否为零：
零时使用 `-1` 颜色，非零时使用 `0xff808080`。该状态改变文本颜色，不调用
`SmallHT` 的 `E` 字形绘制，也不使用 `(x+5, y+8)` 状态点。不能把维修/Home
`4b9e77` 行类的 `E` 外推到 `5ceef8`。

### 可售列表 `lstShopEquip`

可售列表是页面对象 `+0x4c`。产品目录来自页面 `[+0x20]+0x34/0x38` 的项目录，
三支均在 `514e15` 一类遍历中读取 ItemTable：

| 分类 | 分支 | 过滤 | 行状态 |
|---|---|---|---|
| Common | `514de4` | `439762` 在 `8..12`，且 Item 价格选择器 `[+0xf4] != 0` | 无 setter |
| Hat/Balloon | `514f42` | `439762 == 5`，且价格选择器非零 | 无 setter |
| Mark | `515097` | `439762 == 7`，且价格选择器非零 | 无 setter |

三支都用 `4ba7df` 建行并加入 `[page+0x4c]`，但没有 `MyItem+0x1c` 检查或
`4bc85e` 调用。故可售模式在现有来源中保持 `[row+0x4ec] = 0`，不产生拥有/安装态，
也不为本来源新增气球或标志商品记录与价格。

## per-role 标记与当前数据

原 `43ed18` 的 `MyItem+0x1c = 2` 只标记当前角色查询结果中的实例：
`field44`、`field45`、`array1[0..2]`、`array2[0..4]`。它对应
`InventoryRoleBindings` / `applyInventoryQuery` 中当前角色的 `state = 2` 投影。
三段工厂遍历的也都是当前角色实例区间，不是账户内任意战车。

当前 `AccountStore.inventory().records[].state` 不能替代该投影。装备保存
`saveEquipment` 以 `tankEquipment.bindings(accountId)` 的账户级实例集合写入 `state = 2`，
该集合包含所有战车；它可以说明“某实例被某辆战车占用”，但单独看不能说明
“该实例在本账户当前角色/当前战车上装备”。

现已有三处只读 profile 投影可直接给出当前角色安装关系：

- `ResPartSale.profile?: {bytes, strings}`；
- `ResPartMaintenance.profile?: {bytes, strings}`；
- `ResRoleProfile.profile?: {bytes, strings}`。

profile 字节的原确认字段是：

| 原 selector/用途 | profile 偏移 | 当前字段 |
|---|---:|---|
| scalar `44` / 装饰 | `+0x118` | `decorationInstanceId` |
| scalar `45` | `+0x13c` | `markInstanceId` |
| array `2` / 五个部件槽 | `+0x148 + slot*4` | `slots[0..4]` |

当前角色安装等式为：

```ts
installed =
  category === 'Common'
    ? slots.includes(row.instanceId)
    : category === 'Hat'
      ? decorationInstanceId === row.instanceId
      : markInstanceId === row.instanceId;
```

该等式用于原状态：

- `ShopEquipPage/lstMyEquip` `4ba7df`：`installed` -> `+0x4ec = 1`，表现为灰色文本；
- `ShopMendPage/lstPart` `4b9e77`：`installed` -> `+0x3c4 = 1`，表现为 `SmallHT E`；
- `ShopEquipPage/lstShopEquip` product row：不设置状态。

原 producer 不附加 `ownedQuantity > 0`、当前槽位、保养 `canMaintain` 或价格条件。
数量、维修资格、报价、墙钟和确认事务保持各自已结规则，不并入行状态。

## 有限采用

- 商城拥有部件、装饰、标志：`PartShopView` 的 `lstMyEquip` 行可用已有
  `partSale({operation:'QUERY'})` 返回的 `sale.profile` 直接计算 `installed`；SELL 结果
  经原 `setSale` 覆盖同一只读 profile。不增加 `ShopSource.roleProfile()` fallback
  QUERY，也不新增 API、schema、cache 或轮询；profile 缺席或短字节按未知 `false`。
- 商城可售部件、装饰、标志：`lstShopEquip` 不增加安装态，product 行不传 `installed`。
  当前目录没有气球/标志商品时保持空目录，不造记录、价格或购买动作。
- 维修中心拥有部件：`MendShopSourcePage` 复用既有
  `tankMaintenance` → `partMaintenance` → `roleProfile` 优先 bundle，以及原 MAINTAIN
  的 `setProfile({profile: result.profile})` 覆盖，按上式派生 `installed`，并由
  `MendPartRowContent` 使用现有 `HomeRoleRowStatusBadge` 的 `installed`/静态
  `SmallHT E` 状态。维修按钮资格仍取现有报价的 `canMaintain`，不由 `installed` 决定。

## Known Issues

- 原 `ShopMendPage/lstPart` 行状态 `2/3/4` 只有 draw 分支；`518f8a` 三个分类工厂
  没有对应 producer。
- 原 `ShopEquipPage` 拥有行 `4ba7df` 的状态 `1` 只改变文本颜色，没有 `E` glyph；
  当前采用不得把它实现成 Home/维修行的 `E` badge。
- 分类精度：商城 `515684`（拥有 Hat/Balloon）与 `514f42`（可售 Hat/Balloon）均按
  `439762 == 5`，`PartShopView` 的 Hat 筛选保持 `classifyItemId === 5`，未把气球外推。
  维修 `518f8a` coarse `3` 的原分支同时覆盖帽子 `5` 与气球 `6`；当前
  `MendShopSourcePage` 维修 Hat 筛选已支持真实 `classifyItemId === 5 || 6`。当前可售
  目录未提供气球记录，因此不新增商品记录或价格。
- 原 `ShopEquipPage` 可售 Hat/Balloon、Mark 分支存在，但当前可售目录未提供对应
  气球/标志记录；本来源不据此造目录或价格。
- 当前 profile 缺省时只能保持未知/未安装呈现，不能由账户级
  `inventory.state === 2` 或任意 `EquipmentBinding` 反推当前角色行状态。
- 静态来源结论未做运行时、布局或 HD 实测；原字体内部基线和位图放置仍由 CEGUI
  外部实现决定。
