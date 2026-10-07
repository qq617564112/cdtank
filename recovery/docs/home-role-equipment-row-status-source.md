# 我的家装备分类工厂与拥有战车/宠物行状态原来源

范围：UI32/M5-07 与 UI34/M5-08。内容限定为原 Home `MyTank/lstEquip` 的帽子/气球/标志
分类工厂及其 `MyItem+0x1c` 已装备状态，以及原 `OwnedTank`/`OwnedPet` 行状态 setter
的调用范围。给出的是当前二进制能直接确认的有限事实，不是运行时实证。

## Home `MyTank/lstEquip` 分类工厂

Home 页把 `MyTank/lstEquip` 绑定到 controller `+0x13c`：注册块在 `4eac48` 压入字符串
`0x5d2b08`（`MyTank/lstEquip`），并在 `4eac70` 写入 `[page+0x13c]`。同注册块把
`MyTank/rdoCommon`（`0x5d2b48`）、`MyTank/rdoHat`（`0x5d2b38`）、`MyTank/rdoMark`
（`0x5d2b28`）、`MyTank/lstTank`（`0x5d2b18`）分别写到 `+0x12c`、`+0x130`、`+0x134`、
`+0x138`。

分类入口 `4e8621` 以 `[ebp+8]` 分派三支：

| 参数 | 入口 | 角色分组成员 | 接受分类 |
|---:|---|---|---|
| `0` | `4e8a65` Common | `[role]+0x5c` | `43bd09 == 5` |
| `1` | `4e8865` Hat/Balloon | `[role]+0x2c` | `43bd09 == 3` |
| `2` | `4e8651` Mark | `[role]+0x3c` | `43bd09 == 4` |

`[ebp+8]` 由调用者 `4e8d57` 依当前选中的 radio 控件决定：`4e8d29` 比较被点控件与
`[page+0x12c]`（`rdoCommon`）落 `[page+0x7c]=0`，`4e8d39` 比较 `[page+0x130]`
（`rdoHat`）落 `1`，`4e8d46` 比较 `[page+0x134]`（`rdoMark`）落 `2`，随后
`4e8d55/4e8d57` 把该值压栈调用 `4e8621`。因此两页 Hat（`rdoHat`）与 Mark（`rdoMark`）
分别落到分类 `3` 与分类 `4`，不是从 proposal 文本推断。

分类函数体 `43bd09` 读 `[MyItem+0xc]` 调 `4396e0`；`4396e0` 的 `10001..12000` 返回
`3`（帽子/气球）、`12001..13000` 返回 `4`（标志）、`20001..22000` 返回 `5`（Common）。
三个工厂遍历的是当前角色实例区间（分组成员），每支对 `edi` 指向的实例调用
`43bd09`，只接受各自分类。

三支工厂对命中实例的执行顺序一致，均为：

1. `4d8366` 生成名称串，`4d83b3` 生成类别串，`4d849e` 生成天数串。
2. 分配 `0x42c` 字节，`4b9e77` 构造 161×56 原行，vtable `5ceee0`。
3. 经 `[controller+0x13c]`（`MyTank/lstEquip`）的 `call [eax+0x10c]` 把新行插入列表。
4. 读该实例 `[MyItem+0x1c]`：`4e89d7`（Hat/Balloon）、`4e87c5`（Mark）、`4e8bd7`
   （Common）都只比较 `== 2`，命中则压 `1` 并调用 setter `4bbcfd`；非命中不调用。

`4bbcfd` 只执行 `mov [ecx+0x3c4], eax` 后 `ret 4`（`4bbcfd/4bbd01/4bbd07`）；行构造
函数 `4b9e77` 在 `4b9ef7` 把 `[row+0x3c4]` 清 `0`。所以 Home `lstEquip` 帽子/气球/标志
与 Common 行共用同一「已装备 → `row+0x3c4=1`」关系，得到该值的唯一条件是该实例位于当前
角色的对应分组且 `[MyItem+0x1c]==2`。

该工厂的作用范围是 Home `MyTank/lstEquip`（controller `+0x13c`）。原 Shop/Mend 的部件
名单是另一条链：`518f8a` 分派 `[esi+0x5c]`（`ShopMendPage/lstPart`），同样构造 `4b9e77`
行并在 `MyItem+0x1c==2` 时调用 `4bbcfd(1)`（`519125`/`519339`/`519543`）。两者行类相同、
分类入口不同，不能互相外推页面，也不把 Home `lstEquip` 结论套到 Shop/Mend/Trade 的其它名单。

## `OwnedTank` 与 `OwnedPet` 行

`OwnedTank` 行由构造 `4bb3bc` 建立，vtable `5cef2c`（`4bb3f0`），状态成员 `[+0x3c4]`
在 `4bb43c` 清 `0`，字体指针在 `4bb681` 写入 `[+0x3c8]`；draw `4bb6cf` 在 `4bba1f`
读 `[ebx+0x3c4]`，setter `4bbcfd` 写 `[ecx+0x3c4]`。

`OwnedPet` 行由构造 `4bc86b` 建立，vtable `5cef78`（`4bc89f`），状态成员 `[+0x32c]`
在 `4bc8d8` 清 `0`，字体指针在 `4bcb18` 写入 `[+0x330]`；draw `4bcb65` 在 `4bce25`
读 `[ebx+0x32c]`，setter `4bd103` 写 `[ecx+0x32c]`。

两个 vtable 的 draw 槽分别是 `4bb6cf`（`5cef2c+8`）与 `4bcb65`（`5cef78+8`）。两支 draw
对状态成员做同一组递减分派，落点为：

| 状态 | `OwnedTank` draw 落点 | `OwnedPet` draw 落点 | 原字符串对象 | 值 |
|---:|---|---|---|---|
| `1` | `4bbc15` | `4bd01b` | `0x5c192c` | `E` |
| `2` | `4bbb7a` | `4bcf80` | `0x5cee70` | `S` |
| `3` | `4bbadf` | `4bcee5` | `0x5cee74` | `N` |
| `4` | `4bba44` | `4bce4a` | `0x5c6410` | `B` |

状态 `0` 不命中任何分支。上述四个常量是 4 字节 codepoint（`0x45/0x53/0x4e/0x42`），
分支把它们作为原字符串对象压入。

## 真实 setter 调用与可达状态

状态成员只由构造清 `0` 和 setter 写入，没有其它数值直写：`+0x3c4` 的 dword 写入仅
`4bb43c`（清 `0`）、`4bbd01`（setter）；`+0x32c` 的 dword 写入仅 `4bc8d8`（清 `0`）、
`4bd107`（setter）。因此 `OwnedTank`/`OwnedPet` 行的可达状态就是它所属工厂调用 setter
时压入的值。

vtable `5cef2c` 只由 `4bb3bc` 写、`5cef78` 只由 `4bc86b` 写，两个行类的构造点各只有固定
几处：`4bb3bc` 在 `4b64cd`、`4ecddf`、`4fc890`、`51a15e`；`4bc86b` 在 `4de405`、
`4fc6b5`。只有这些点建立的 `+0x3c4`/`+0x32c` 才是本行类状态。

会写 `+0x3c4` 的 setter `4bbcfd` 全部调用点，及其所属工厂构造的行类与压入值：

| 调用点 | 压入 | 行构造 | 页面/入口 |
|---|---:|---|---|
| `4b64fe` | `3` | `4bb3bc` | `LabPage/lstTank`（`+0x34`） |
| `4e87cf` | `1` | `4b9e77` | Home `MyTank/lstEquip`（Mark 支） |
| `4e89e1` | `1` | `4b9e77` | Home `MyTank/lstEquip`（Hat/Balloon 支） |
| `4e8be2` | `1` | `4b9e77` | Home `MyTank/lstEquip`（Common 支） |
| `4e304a` | `1` | `4b886d` | 部件/装备名单 `[+0x1f4]`（`43bd13==1`，`+0xc` 分组） |
| `4e3298` | `1` | `4b886d` | 部件/装备名单 `[+0x254]` |
| `4e4e07` | `1` | `4b886d` | 部件/装备名单 `[+0x1f4]` |
| `4e9c9d` | `1` 或 `0` | `4b9e77` | Home `MyTank/lstEquip`（`+0x13c`）列表项重设 |
| `4e9ea5` | `1` 或 `0` | `4b9e77` | Home `MyTank/lstEquip` 列表项重设 |
| `4ea0ed` | `1` 或 `0` | `4b9e77` | Home `MyTank/lstEquip` 列表项重设 |
| `519125`/`519339`/`519543` | `1` | `4b9e77` | `ShopMendPage/lstPart` |
| `4ece11` | `3` | `4bb3bc` | Home `MyTank/lstTank`（`+0x138`） |
| `4fabeb` | `0` | Trade `lstMyTankMyPet` 行 | Trade 名单项重置 |
| `4fadef` | `0` | `4b886d` | Trade `lstMyItem`（`+0x120`）行重置 |
| `4fb6ad` | `1` 或 `4` | `4b886d` | Trade `lstMyItem`（`+0x120`） |
| `4fb8b2`/`4fba85`/`4fbc36` | `4` | `4b886d` | Trade `lstMyItem` |
| `4fc8d8` | `3` 或 `4` | `4bb3bc` | Trade `Trade/lstMyTankMyPet`（`+0x11c`） |
| `500b88`/`500b8f` | `4` | 列表项 | Trade 页名单更新 |
| `501dfa`/`501e01` | `4` | 列表项 | Trade 页名单更新 |

会写 `+0x32c` 的 setter `4bd103` 全部调用点：

| 调用点 | 压入 | 行构造 | 页面/入口 |
|---|---:|---|---|
| `4de439` | `3` | `4bc86b` | Home `MyPet/lstPet`（`+0x18c`） |
| `4fc6f9` | `3` 或 `4` | `4bc86b` | Trade `Trade/lstMyTankMyPet`（`+0x11c`） |
| `4fac8f` | `0` | Trade `lstMyTankMyPet` 行 | Trade 名单项重置 |
| `500b7c` | `4` | 列表项 | Trade 页名单更新 |
| `501dee` | `4` | 列表项 | Trade 页名单更新 |

对 `OwnedTank`/`OwnedPet` 行类本身，恢复到的 producer 只有：

- 状态 `3`：Home `MyTank/lstTank`（`4ece11`）、Home `MyPet/lstPet`（`4de439`）、
  `LabPage/lstTank`（`4b64fe`）、Trade `Trade/lstMyTankMyPet`（`4fc8d8`/`4fc6f9`）。
  这些点在记录实例等于当前行实例（Home 用 `profile+0xa8`（战车）/`profile+0xa4`（宠物），
  Trade 用角色实例 getter）时压 `3`。
- 状态 `4`：仅 Trade `Trade/lstMyTankMyPet`（`4fc8d8`/`4fc6f9`）。在「实例等于当前」
  之外，还经页面 12 项目录表判定：`4fa1ff` 遍历 `[page+0x140+0x14k]` 与
  `[page+0x148+0x14k]`（`k=0..11`），与传入的两个值比对，命中才压 `4`。该表的业务语义
  未在本范围内确认。
- 状态 `0`：构造初值。`51a15e`（`ShopMendPage/lstTank`）构造 `4bb3bc` 行后不调用 setter，
  这些行停在 `0`；Trade 的 `4fabeb`/`4fac8f` 也会把 `lstMyTankMyPet` 行重置为 `0`。

状态 `1`（`E`）与状态 `2`（`S`）在这两个行类上没有 producer：`OwnedTank`/`OwnedPet`
构造点处的 setter 只压 `3` 或 `4`（或根本不调用）。状态 `1` 的 producer 全部落在其它行类
（`4b9e77` 装备行与 `4b886d` 部件行，见上表），其 draw、vtable 与 `OwnedTank`/`OwnedPet`
不同，不能据此点亮本行类。状态 `2` 在全部 `4bbcfd`/`4bd103` 调用点都没有出现过，只在两支
draw 里有分支。因此不在本范围把字母 `E`/`S` 或任何 selected/raw flag/期限映射到这两个
行类的 `1`/`2`。

## 当前采用合同

原链给出两条独立事实：

1. Home `MyTank/lstEquip` 帽子/气球/标志行（分类 `3`/`4`）与 Common 行：实例属于当前
   角色对应分组且 `[MyItem+0x1c]==2` → 行状态 `1`。当前角色的分组标记由
   `43ed18` 写 `[record+0x1c]=2`，其共享实现是 `InventoryRoleBindings {field44, field45,
   array1, array2}`；现端对应 `applyInventoryQuery` 里 `record.state = 2` 的 per-role 标记
   （`markEquipped(2, role.field44)`、`markEquipped(5, role.field45)`、`array1[0..2]`、
   `array2[0..4]`）。这是 per-role 范围，不是账户级 `state 2`。
2. 现端 Home 装备名单的消费者不用 `inventory.state`，而用已确认的 Equipment target
   bundle：`equipment({operation:'QUERY', tankInstanceId})` 返回
   `bindings: {instanceId, tankInstanceId, target, slot}[]`、`tankInstanceId`、
   `decorationInstanceId`、`markInstanceId`。`AccountTankEquipment.save/project` 显式写
   `target='PART'|'DECORATION'|'MARK'` 三类，`DECORATION`/`MARK` 经
   `writeRoleProfileCosmetic` 落到 `decorationInstanceId`/`markInstanceId`。

因此对 Home 装备行（含帽子/气球/标志）可用的「已装备」条件是：

```ts
equipment.bindings.some(binding =>
  binding.instanceId === row.instanceId &&
  binding.tankInstanceId === equipment.tankInstanceId)
```

`bindings` 是账户级全账号集合，所以必须同时匹配当前行的 `instanceId` 与请求确认的
`equipment.tankInstanceId`；仅凭 `bindingName` 存在、任意全局 `inventory.state 2`、或未被
target 约束的引用都不成立。行本身已按 `equipmentTarget(itemTableId) === pageTarget`
归到 `PART`/`DECORATION`/`MARK` 之一，而 `EquipmentBinding.target` 携带同一 target，
所以帽子/气球（`DECORATION`）与标志（`MARK`）可以被该 bundle 覆盖；如需显式约束可再要求
`binding.target === pageTarget`，但 `instanceId` 唯一且由该实例的物件 target 决定，两者一致。

需要注意的两点采用边界：

- `PART` 的 `slots` 是旧层已支持的入口，只投影 `target==='PART'` 的绑定。它不能拿来推
  `DECORATION`/`MARK`；帽子/标志必须走各自 target 的 binding 与 `decorationInstanceId`/
  `markInstanceId`，不能用 `slots` 反推。
- 现端 `HomeEquipmentSourceList` 目前只对 `equipmentGroup==='common'` 的行把
  `installed` 透传给 `HomeEquipmentCommonRowContent`；Hat/Balloon/Mark 分支传
  `installed={undefined}`。数据接口已能给出 `DECORATION`/`MARK` 的 binding，但这两个 target
  的 `E` 位尚未接线。这是可实施点，不是数据缺口。

## Known Issues

- `OwnedTank`/`OwnedPet` 行类状态 `1`（`E`）与 `2`（`S`）没有恢复出 producer；状态 `2`
  在全部已定位 setter 调用点都没有出现，只在 draw 分支里存在。两状态含义不据此推定。
- Trade 页状态 `4` 依赖的 `4fa1ff` 12 项目录表语义（`[page+0x140+0x14k]` /
  `[page+0x148+0x14k]`）未在本范围内确认；`500b88`/`500b8f`、`501dfa`/`501e01`、
  `500b7c`、`501dee`、`4fac8f` 从列表项取行后写状态，其行类未在各自函数里重建。
- CEGUI `Font::drawText` 的 glyph 内部基线、字符推进与位图放置属外部实现；本范围只恢复
  调用点、字体指针、原字符串与资源元数据。
- 静态源结论未做运行时实测；不称 runtime/HD/父项完成。
