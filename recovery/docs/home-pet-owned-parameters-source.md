# 我的家宠物剩余拥有参数原显示源

M5-08/UI-34。本批只恢复 `myhome_petpage.xml` 尚未消费的动态参数：四条原
`ProgressBar`（`prgLightTank/prgMediumTank/prgHeavyTank/prgCruiser`，原控件无 Text）
及其 `429e41` 显示投影，并登记同页其余已接/未接动态控件。来源为
`recovery/output/current-exe.asm` 原指令、原控件布局，加已验证 PetTable/TankTable/
SkillTable 与现确认 `OwnedRoles`/`RoleProfile`/`Inventory`。原 server 未取得：下方
「原事实」只记反汇编可见的来源与算术，「采用规则」是本页在现确认资料上的明确重建。

## 原事实：本页 setter

原 Home 宠物子页更新函数 `4dcfb0`；列表选中先经 `4dd370` 落到页成员：
选中实例 id 经 `41e99c(manager+0x40+0x10, id)` 取得 owned base 记录存入 `[esi+0x20]`，
该记录 `+8` 定义经 `413c83`+`411068` 查 PetTable 行存入 `[esi+0x24]`
（`4dd389`–`4dd3b6`）。`427ba2(this)` 返回当前宠物记录（键 `get(0x1c)`），
`427bf9(this)` 返回当前战车记录（键 `get(0x1d)`）。

`4dd02c` 调 `429e41`：`arg0=&[ebp-0x30]`（out）、`arg1=[esi+0x20]`（选中 owned base）、
`arg2=427bf9(this)`（当前战车记录）；out 数据指针落在同一结构的 `+4`（`[ebp-0x2c]`）。
四条进度在 `4dd046`–`4dd0aa` 按同一次序写入页成员：

| 控件（成员） | out 索引 | 算术 |
| --- | --- | --- |
| prgLightTank (0x13c) | out[21] = `[data+0x54]` | `f32(值 × f32 0x5c4794=0.2)` |
| prgMediumTank (0x140) | out[22] = `[data+0x58]` | 同上 |
| prgHeavyTank (0x144) | out[23] = `[data+0x5c]` | 同上 |
| prgCruiser (0x148) | out[24] = `[data+0x60]` | 同上 |

同函数 `4dd0f3`–`4dd1c2` 另写 `txtLife/txtCritical/txtLucky`（成员
`0x14c/0x150/0x154` ← out[0]/out[0x10]/out[0x14]）。现页这三项已按 base
`+0x2c/+0x34/+0x3c` 接，本批不重做，只在「已接边界」登记。

## 原事实：429e41 入口、门禁与输出

入口 `429e41`：`429e76`/`429e82` 任一 `arg1` 或 `arg2` 为零即跳 `42a4f4` 空路径，
`42995c` 建的 out 是 25 个 int 的零模板，空路径原样拷回，故本页在缺选中宠或缺当前
战车记录时 out 全 0、四条进度均为 0。非空时按以下顺序：

1. `429e8a` 调 `429cf3(this, arg1)`：先清 `this+0x44` 的累加器 `A`；`429d3d` 仅在
   `arg1[0]==427ba2(this)[0]`（选中宠即当前宠）时走 `429d43`–`429de1` 遍历角色技能表
   `[0x633588+0x120]`；两条分支在 `429ded` 汇合后**无条件**遍历 `arg1` 六技能
   （`arg1+0x44` base、`arg1+0x5c` rank），都经 `429714` 折入 `A`。
2. `429e41` 的 `429eab`–`429ed9` 门禁（`429eb6`）：比较 `arg2+0x1c` 与
   `427bf9(this)+0x1c`；不等才把本地 `A` 每个 int 清 0。本页 `arg2` 就是
   `427bf9(this)`，恒相等，`A` 恒保留。
3. `429edb`–`429f66` **无条件**对 `arg2+0x58/+0x5c/+0x60` 三个内部部件槽：`413c74`
   取物品定义，读物品 `+0x108/+0x10c/+0x110` 三个技能 id，`413c65` 取技能定义后
   经 `429714` 折入 `A`。
4. `429f68`–`429fb7`：`arg1+8` 定义经 `413c83`+`411068` 查 PetTable 行，
   `out[21..24] = PetTable[+0x7c/+0x80/+0x84/+0x88] + A[21..24]`。
5. `429fba`–`42a00b` 另做一次 `arg2+0x1c == 427bf9+0x1c` 判定；成立且
   `arg2+0x34 == 0` 时，按 `arg2+0x24` 查到的 Tank 行 `+0x50`（TankType）从
   `out[21+(TankType−1)]` 减 1（`429f81`–`429f87` 置 flag，`42a008/42a000/429ff8/429ff0`
   对应 type 1/2/3/4）。

`429714` 只收 `skill+0x2c==0`（被动）的技能，按索引累加：`0..20` 对应
`skill+0xe8..+0x138`，`21..24` 对应 `skill+0x148/+0x14c/+0x150/+0x154`，即四组
`STankMastery/MTankMastery/LTankMastery/StugMastery`。

## 原事实：四项进度的组成

`out[21..24] = PetTable(选中 base 定义 +8)[STankMastery,MTankMastery,LTankMastery,STugMastery]
+ A[21..24]`，再按上节第 5 步做一次减 1；原进度 = `f32(该值 × 0.2)` 写
`prgLightTank/prgMediumTank/prgHeavyTank/prgCruiser`（顺序即 STank/MTank/LTank/Stug）。

`A[21..24]` 来自：选中宠六技能被动（**无条件**，非当前宠也叠）；`arg1[0]` 等于当前宠
时另叠角色技能表 `[0x633588+0x120]` 一项（其条目身份与构造未证）；当前战车 `arg2`
三个内部部件槽 `+0x58/+0x5c/+0x60` 的物品技能被动（**无条件**）。

三点由此确定：

- 非当前宠物仍叠当前战车内部三 item：本页 `arg2` 恒当前战车，`429eb6` 不清 `A`，
  `429edb` 的物品循环不依赖选中宠的当前资格。
- 独立五装备（`profile+0x148` 起安装的 5 件）在 `429e41` 内不参与：`429edb` 只读
  `arg2` 记录自身的 `+0x58/+0x5c/+0x60` 三槽，不读 `profile` 的 `+0x148..`。角色技能表
  `[0x633588+0x120]` 是另一独立项，仅 `arg1[0]==当前宠` 时并入，身份未证。
- 需要当前战车存在：`arg2=427bf9(this)`；当前记录不存在（如非模式 2）时 `429e41`
  走空路径，out 全 0。

## 原事实：控件与图片合同

| 控件 | Type | AbsoluteRect | 图片/文本 |
| --- | --- | --- | --- |
| prgLightTank | WindowsLook/ProgressBar | l:50 t:43 r:110 b:55（在 tankecanshuqu 内） | `ProgressImage=set:mycabin00 image:data\ui\mycabin0\xiaoxingxing2.tga`；无 Text/TextColours |
| prgMediumTank | WindowsLook/ProgressBar | l:162 t:43 r:222 b:55 | 同上 |
| prgHeavyTank | WindowsLook/ProgressBar | l:49 t:69 r:109 b:81 | 同上 |
| prgCruiser | WindowsLook/ProgressBar | l:162 t:69 r:222 b:81 | 同上 |

四条原控件都无 `Text`，进度只用 `ProgressImage` 填充条（无独立 `BackgroundImage`、
无 TextColours）。标签底图由同页 `hangditu8`（`maogoushuliandu.tga`）与 `lblTank`
（`shuliandu.tga`）承担，现页已画。Web 资产在 `ui.json`：`mycabin00` 的
`xiaoxingxing2.tga` → `ui/regions/69/188.png`（dds）或 `ui/regions/36/188.png`。

## 采用规则（现确认资料上的明确重建）

原 server 未取得，按确认来源还原本页 `429e41` 的输入与门禁，采用规则如下（与原事实
分开记，不把采用写成原 setter）：

| 原输入 | 现来源 |
| --- | --- |
| `arg1`=选中 owned base | 当前 `displayed`/选中的 `OwnedRoles.base` 记录 |
| `arg1+8` 宠物定义 | 该 base 记录 `fields.get(8)` |
| `arg1+0x44/+0x5c` 六技能 base/rank | 该 base 记录 `fields` 的 `0x44+slot*4`/`0x5c+slot*4` |
| `arg2`=当前战车记录 | `OwnedRoles.equipment` 中 `+0x1c` 等于 `RoleProfile.profile+0xa8` 的记录 |
| 当前宠资格 `isCurrent`（角色技能表门禁） | `RoleProfile.profile+0xa4` 等于选中 base `fields.get(0)`；用 `currentPetInstance` 传入 |
| 角色技能表 `[0x633588+0x120]`（仅 current） | **Web 采用**：同 session `RoleProfile.profile+0x148` 起五个已装实例，经现 `Inventory` 确认后转为 `catalog.item(itemTableId).skillIds` 的被动精通；不宣与原表一一等价 |
| `arg2+0x58/+0x5c/+0x60` 部件物品 | 当前战车记录 `fields` 的 `0x58/0x5c/0x60` |
| 物品 `+0x108/+0x10c/+0x110` 技能 | `Inventory`/`catalog` 物品定义的 `skillIds` |
| 技能 `+0x148..+0x154` 精通 | `catalog` 技能定义的四项坦克精通属性 |
| PetTable `+0x7c..+0x88` | 宠物定义 `fields.get(8)` 的 `STank/MTank/LTank/StugMastery` |

五装备的 `itemTableId` 取现 `HomeRoles` 已有真 `Inventory` 查询结果：`equippedItemIds`
在 `home-roles.tsx` 由 `battle.inventory()` 的 `record.state===2 && ownedQuantity>0`
且 `record.instanceId` 命中 `profile+0x148 + slot*4`（5 槽）过滤得到，再 `map` 为
`itemTableId`；本页直接消费该数组，不新增请求、不改 `home-roles.tsx` 的查询。

可实施方案（Home 专属派生，四组一次给出；不改已完成 Shop helper）：

```
homePetOwnedMastery({selectedBase, currentTank, currentPetInstance, equippedItemIds, catalog})
  base[0..3] = petTable(selectedBase.fields.get(8))[STank,MTank,LTank,Stug]
  isCurrent = currentPetInstance !== undefined
    && currentPetInstance === selectedBase.fields.get(0)
  bonus = [0,0,0,0]
  for slot in 0..5:                      // 无条件：选中宠六技能
    b=selectedBase.fields.get(0x44+slot*4); r=selectedBase.fields.get(0x5c+slot*4)
    if b==undefined or r==undefined -> unknown
    if b==0 or r==0 -> continue          // 合法空槽，无加成
    addSkillMastery(bonus, catalog.skill(rankedPetSkillId(b,r)))   // 429714, 仅 triggerType==0
  for item in currentTank.fields.get([0x58,0x5c,0x60]):    // 无条件：当前战车三内部槽
    if item==undefined -> unknown
    if item==0 -> continue
    addSkillMastery(bonus, catalog.item(item).skillIds)
  if isCurrent:                          // Web 采用：role 技能表分量
    if equippedItemIds==undefined -> unknown   // current 必须已确认五装备
    for itemId in equippedItemIds:
      if itemId==0 -> continue
      item=catalog.item(itemId); if item==undefined -> unknown
      addSkillMastery(bonus, item.skillIds)
  mastery[0..3] = base[0..3] + bonus[0..3]
  if currentTank.fields.get(0x34)==undefined -> unknown      // 必需，判断原一次减1
  tankType = tankType(currentTank.fields.get(0x24))          // 必需，定位 type1..4 组
  if tankType==undefined -> unknown
  if currentTank.fields.get(0x34)==0:    // 429f81/42a00b
    mastery[tankType-1] -= 1
  progress[0..3] = f32(mastery[0..3] * f32(0.2))
```

采用与资格规则：

- 需要选中 `selectedBase`、当前战车 `currentTank`、`catalog` 三者齐全；任一缺失留空
  （unknown），不用目录值冒称。原 `429e41` 在缺记录时给 0，但本页按「未知值空」采用，
  只有真正算得 0 才显示 0。
- 当前宠 `isCurrent` 明确定义为 `currentPetInstance !== undefined &&
  currentPetInstance === selectedBase.fields.get(0)`；`currentPetInstance` 取
  `RoleProfile.profile+0xa4`，`selectedBase.fields.get(0)` 是选中 owned base 实例键。
- 选中宠六技能**无条件**折入（非当前宠也叠），与 `429cf3` 的六技能循环一致；
  `petOwnedMastery`（Shop）把六技能包在 `isCurrent` 内是 Shop 的采用，本页不照搬。
- 当前战车三内部槽物品**无条件**折入；**五装备只在 `isCurrent` 时折入**，非当前宠
  不并入五装备，但自己的六技能与当前 Tank 三直接 slot 仍无条件叠。
- 五装备 role 贡献是**明示 Web 采用**：以 `profile+0x148` 五个已装实例经现 `Inventory`
  确认后转 `catalog.item(itemTableId).skillIds` 的被动精通，替代原未恢复的角色技能表
  `[0x633588+0x120]` 分量。该采用不宣原表身份已恢复，也**无法证明与原角色技能表一一
  等价**；这是本页 selected 支持范围的采用决定。
- `current` 宠必须有 `currentPetInstance` 与现 `equippedItemIds` 都确认就绪
  （`equippedItemIds !== undefined`）；`isCurrent` 但 `equippedItemIds` 缺失即 unknown。
  非 current 不需要外部五装备，`equippedItemIds` 可缺省。
- 合法 `skill/item==0` 是真空槽，无加成；非 0 的 base/rank/item/skill 找不到确认定义、
  或 `home-roles.tsx` 的现 `Inventory` 结果缺该实例确认时，该宠物四组留空（unknown），
  不造默认宠物。
- Tank `+0x34` 必需才能判断原一次减 1；当前 Tank 定义（`fields.get(0x24)`）与 TankType
  必需才能按原 type1..4 定位该组。任一缺失留空。
- `429714` 整数累加按 int32（`| 0`/`Math.imul` 语义）；四组 mastery 是整数，输出进度
  `f32(mastery × f32 0.2)` 保持原倍数。
- **不使用** `petShopMastery(petId)`（Buy 目录）或 `tradePetOwnedMastery`（Trade base）
  代 Owned；二者都缺上述技能/部件/减 1 聚合。**不修改**已完成的
  `pet-shop-mastery.ts` / `pet-shop-directory-details.tsx`。
- 进度是 fraction（`mastery × 0.2`，视觉裁 0..1）；原 ProgressBar 无 Text，故不新增
  数字标签，只画填充条。

## 已接边界（本批只登记，不评价）

- `txtLife/txtCritical/txtLucky`（成员 `0x14c/0x150/0x154`）：原 `4dcfb0` 写
  `out[0]/out[0x10]/out[0x14]`（`42a377`–`42a3f1`：`A[0]+arg1+0x2c`、`A[4]+arg1+0x34`、
  `A[5]+arg1+0x3c`）。现页读 base `+0x2c/+0x34/+0x3c`，不含这些技能加成项。
- 六技能名称/等级、`txtTech`、学习弹窗与 `edtPetDesc`、`txtPetName`、`txtMoney`、
  `txtListQuantity`：原页与现页均已有来源，本批不改。

## 未接动态控件

- 四条 `ProgressBar` 现页未消费；本批合同即为其来源。
- 同页 `txtType`（`tankeshengjiqu` 子项，l:87 t:-18 r:147 b:-1）也是动态文本，原
  `4dcfb0` 经 `4d8e07`/`4d8c0b` 由 PetTable `+0x30`（PetType）与 `+0x2c`（PetSize）
  拼本地化串写入成员 `+0xf0`。原 getter 定位见 `recovery/docs/home-owned-pet-row-consumer.md`
  （复用 `4d8c0b` 消费者）；现同目录已有同原映射
  `apps/web/src/interface/account/pet-shop-row-display.ts` 的
  `sourcePetKind(petSize, petType)`（由
  `apps/web/src/interface/home/home-owned-pet-row-content.tsx` 消费），可直接按 PetTable
  `PetSize`/`PetType` 取串，不重做类型本地化。未知 `petSize`/`petType` 仍为空。成员↔控件
  对应由 setter 与布局位置推定，未做字节级 control-name 证明。

## 未证边界

角色技能表 `[0x633588+0x120]` 条目身份/构造仍未恢复，本页五装备 role 采用**不能证明**
与原表一一等价；`429714` 技能 `+0xe8..+0x154` 全属性目录映射、本页 `arg2+0x34` 的账户
语义、原 setter 最终色/字形/高清、原 device 像素与原 server 规则均未证。`txtType` 的
`4d8c0b` 本地化 id（`0x2a3..0x2a7/0x2ad`）未证，但现 `sourcePetKind` 已是同原映射的
Web 采用。四条进度是原 Home 显示投影，不是对战最终属性。
本批只做原事实与采用合同，未运行 unit/test/browser/build/typecheck/lint/generator，
不把代码走查当作页面/HD/持久/实测通过；M5-08/UI-34 父项不勾。
