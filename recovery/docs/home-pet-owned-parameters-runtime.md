# Home 宠物剩余拥有参数运行态 (M5-08/UI-34)

本页把 `myhome_petpage.xml` 剩余动态参数接成运行态：四条原熟练度 `ProgressBar`
（`prgLightTank/prgMediumTank/prgHeavyTank/prgCruiser`）与同页 `txtType`。原事实与采用
映射见 `home-pet-owned-parameters-source.md`；本文只记终态接口、计算、资格、绘制更新与
限制。

## 接口

- `homePetOwnedMastery({selectedBase, currentTank, currentPetInstance, equippedItemIds,
  catalog})`（`apps/web/src/interface/home/home-pet-owned-mastery.tsx`）一次派生四组
  `{mastery: number[], progress: number[]}`，或 `undefined` 表示本页不绘制。
- `HomePetOwnedMastery({ui, selectedBase, currentTank, currentPetInstance, equippedItemIds,
  catalog})` 按四条原控件矩形绘制进度；`homePetOwnedMastery` 返回 `undefined` 时渲染
  `null`。
- `home-roles.tsx` 同 session 透传：`selectedBase=displayed`（候选或当前）、`currentTank`
  （`owned.equipment` 中 `fields.get(0x1c)==profile+0xa8` 的记录）、
  `currentPetInstance=profile+0xa4`、`equippedItemIds=masteryEquippedItemIds`、
  `catalog=roleCatalog`。五装备确认结果存于 `PetMasteryEquipment` bundle，保存请求时的
  `profile`/`battle`/`accountGeneration` 与 `itemIds?`；render 只在三者与当前同身份时才把
  `itemIds` 透传为 `equippedItemIds`，否则传 `undefined`。
- `txtType` 由 `home-pet-owned-details.tsx` 消费：`record.fields.get(8)` 查
  `catalog.petTypes`，经 `sourcePetKind(petSize, petType)` 出串。

## 计算

`mastery[0..3]` 以选中 `displayed.pet` 定义（`fields.get(8)` →
`gameContent().pets.get(definitionId).attributes.mastery`，原 PetTable
`+0x7c/+0x80/+0x84/+0x88`）为基值，再按 int32 累加被动精通（`triggerType==0`）：

- 自身六技能：`fields.get(0x44+slot*4)` base 与 `fields.get(0x5c+slot*4)` rank 经
  `rankedPetSkillId` 得技能 id；`base==0 || rank==0` 为合法空槽跳过。**无条件**，非当前宠
  也叠。
- 当前 Tank 三内部 item：`currentTank.fields.get(0x58/0x5c/0x60)` 的
  `catalog.items[...].skillIds`；`itemId==0` 跳过。**无条件**。
- 当前宠五装备分量（**明示 Web 采用**，仅 `currentPetInstance === fields.get(0)` 时）：
  `equippedItemIds` 即 `profile+0x148+slot*4` 五个已装实例，经现 `Inventory` 确认后取
  `catalog.items[...].skillIds`。替代原角色技能表 `[0x633588+0x120]` 分量。

`Tank+0x34==0` 时按 `fields.get(0x24)` 查 `catalog.tankTypes` 的 TankType，从
`mastery[TankType-1]` 减 1。输出 `progress[i] = Math.fround(mastery[i] * Math.fround(0.2))`，
保持原 `f32(值×0.2)` 倍数。

## 资格

- `selectedBase`、`currentTank`、`catalog`、`currentPetInstance` 任一缺失 → `undefined`，
  四条留空。
- 基值定义缺失或不足四项 → `undefined`。
- 任一**非 0** 的 base/rank/item/skill id 找不到确认定义 → `undefined`。
- `currentPetInstance === fields.get(0)` 时 `equippedItemIds` 必须已确认就绪；缺失 →
  `undefined`。非当前宠不需要 `equippedItemIds`，仍无条件叠自身六技能与当前 Tank 三直接
  slot。
- `currentTank.fields.get(0x34)` 缺失、或 TankType 缺失/越界 → `undefined`。
- 合法 `0`（base/rank/item/skill/instance）是真空槽，无加成；只有真正算得
  `mastery==0` 才渲染 0，不被抹。
- 不新增请求/学习或协议事务；五装备复用 `home-roles.tsx` 现 `battle.inventory()` 结果，
  非零实例必须 `state===2 && ownedQuantity>0`，全确认才成立，否则整组 unknown。
- candidate/page 变化由当前 `displayed` 在渲染直接重新派生，不触发 Inventory effect；该
  effect 只依赖 `[battle, profile]`，身份变化时先清 `masteryEquipment` 并以 `active` 取消迟到
  回调。确认 bundle 保存请求时的 `profile`/`battle`/`accountGeneration`，render 只在三者与当前
  同身份时透传其 `itemIds`，否则 `undefined`；即便 effect 尚未清除，旧五装备也不会串入新
  profile。

## 绘制更新

- 控件矩形用 `HomeSourceLayout(ui, 'myhome_petpage.xml').control(name)`。
- 填充用原 `ProgressImage`（`sourceProps(..., 'ProgressImage')`），按
  `fraction=clamp(progress,0,1)` 以 `clipPath: inset(0 (width-extent)px 0 0)` 裁剪，
  与现 Home/Shop 进度条同一模式。
- 原 `ProgressBar` 无 `Text`，不新增数值标签；进度条 `pointerEvents:'none'`，
  `role="meter"`、`aria-valuemin=0`、`aria-valuemax=max(5,value)`、`aria-valuenow=value`。
- `txtType` 用 `SourceStaticText` 落在原 `txtType` 位置，动态文字保持原用户字体；未知
  `petSize/petType` 出空串。

## 限制

- 原角色技能表 `[0x633588+0x120]` 条目身份/构造未恢复；本页五装备采用**不能证明**与原表
  一一等价。
- 原未恢复 producer、原 setter 最终色/字形/高清、原 device 像素与原 server 规则未证；四条
  进度是原 Home 显示投影，不是对战最终属性，本页等价来源亦未证。
- `4d8c0b` 本地化 id 未证，现 `sourcePetKind` 为同原映射的 Web 采用。
- 只覆盖四条熟练度与 `txtType`；HP/crit/lucky、六技能、学习等既有边界不在此重做。
- 本批仅执行一次集中静态走查；五装备确认归属为渲染时按同身份透传的终态。source/页面/
  网络/持久/HD 实际验收未执行，不据此关闭 M5-08/UI-34 父项。
