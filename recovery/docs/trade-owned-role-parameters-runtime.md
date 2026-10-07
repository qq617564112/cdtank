# 交易三详情页剩余动态参数运行时接线

对应 M5-11-DETAIL-PARAMETERS 与 UI-61/62/63。来源事实见 `trade-owned-role-parameters-source.md`。
本文记 Web 采用实现：三个详情页消费确认 `TradeRecordView` 的 `role.fields`，只用本记录字段与本地
目录投影原参数，不读发起方 current profile、不请求对方完整账户、不新增 QUERY/API/schema/wallet
或任何交易写。

## 落点

- `apps/web/src/interface/account/trade-owned-role-parameters.ts`：新增投影 helper，导出
  `tradeTankOwnedParameters(record, catalog)`（战车）与 `tradePetOwnedMastery(record, catalog)`
  （宠物）。两者入参都是确认拥有记录与本地 `CombatCatalog`。
- `apps/web/src/interface/account/trade-source-detail.tsx`：唯一消费者，把 helper 结果写入 `texts`
  映射并渲染新增 `ProgressBar`；沿用既有 `SourceStaticText`/动态用户字体/原图片几何与
  record/offer/详情生命周期。

## 确认资格

字段一律取自 `new Map(record.role.fields)`；仅当 `record.role` 存在、`record.kind` 与该控件页一致、
且所需 offset 均在 map 中时接线。任一必需 offset 缺失则该控件留空，不猜、不取本机 current
profile、不补 `0`。

- 合法 `0` 照常显示 `0`：本目标 offset 确认的 `0` 输出 `0`。
- `itemId 0` 与 `skillId 0` 是合法空槽、无加成，不查 0 号定义、不当缺确认。
- 非零 `itemId`/`skillId` 在本地目录查不到定义才是 unknown（该项留空）。
- 已确认被动技能定义（`triggerType===0`）某属性未配置 → 该属性按 `0` 累加，不当作整组 unknown。

## 战车（`record.kind==='tank'`，原 `0x50109b`）

`base = HOME_TANK_PARAMETER_BASES[fields.get(0x24)]`，只取
`[TankType,TankMove,TankTurn,TankDelay,TankBullet,SideDef,BackDef]` 基准行，不复用整段
`homeTankParameters` 聚合，只读 Home 基准表、不读 current profile。`itemBonus(attr)` 遍历三部件槽
`[0x58,0x5c,0x60]`：`fields.get(slot)===0` 跳过；非零 `itemId` 查 `catalog.items`，查不到该 item
定义即 unknown（相关控件留空）；对其 `skillIds`，`skillId===0` 跳过，非零查不到 skill 定义即
unknown，查到且 `triggerType===0` 则累加 `skill.attributes[attr] ?? 0`。

| 控件 | 采用公式 | 必需字段 |
| --- | --- | --- |
| txtPanzerSide | `base[5] + itemBonus('SideDef')`（不夹取） | `0x24`,`0x58`,`0x5c`,`0x60` |
| txtPanzerBack | `base[6] + itemBonus('BackDef')` | 同上 |
| txtMoveSpeed | `(base[1] + itemBonus('ItemMove') + 2) * 10` | 同上 |
| txtRotateSpeed | `(base[2] + itemBonus('ItemTurn')) * 4 - 1` | 同上 |
| txtShootInterval | `((base[3] + itemBonus('Delay')) * Math.fround(0.1)).toFixed(1)` | 同上 |
| txtAttackLevel | `String(fields.get(0x44))` | `0x44` |
| txtPanzerLevel | `String(fields.get(0x54))` | `0x54` |
| txtSlot | `String(fields.get(0x6c))` | `0x6c` |
| txtInternalPart0/1/2 | `catalog.items.find(i => i.itemTableId===fields.get(0x58/0x5c/0x60))?.name` | 对应槽 |
| prgLoadingTime（文本） | `String(Math.round((base[3] + itemBonus('Delay')) * 2))` | `0x24`,`0x58/0x5c/0x60` |
| prgLoadingTime（进度） | `(base[4] + itemBonus('MaxBullet')) * Math.fround(1/6)` | 同上 |

`prgLoadingTime` 本页新增 `ProgressBar` 渲染（参 `tank-shop-buy-parameters-view.tsx`）；其文本走
`SourceStaticText` 或同层 caption。原交易方法 `0x50109b` 的容量进度有独立 setter，不能把 Shop
Owned 的「无容量 setter」套到 Trade。三部件槽 `0x58/0x5c/0x60` 必须都有确认值；某槽 `itemId 0`
合法无贡献，对应 `txtInternalPart` 名称留空，不写 `"0"`。既有单位控件
（`movSpdUnit`/`rotateSpdUnit`/`sec`/`baifen`/`baifen2`/`baifenjiahao`/`baifenjiahao2`）不改。

## 宠物（`record.kind==='pet'`，原 `0x4fbf7f`）

`mastery = petShopMastery(fields.get(8))`，取自原 PetTable 定义行 `+0x7c..+0x88` 四精通，非记录
聚合，也不混本人 Pet 六技能或当前 Tank 被动，不读 raw `+0x54..+0x60` 做 Shop 熟练度。四条
`ProgressBar` 采用 `prgLightTank/prgMediumTank/prgHeavyTank/prgCruiser = Math.fround(mastery[i] *
Math.fround(0.2))`，本页新增渲染；`fields.get(8)` 缺失或 `petShopMastery` 无结果时四条留空。

既有 `txtHP`（该记录 `+0x2c` 生命值）、`txtSavage`/`txtLucky`（暴击/幸运）、六技能名称/rank 与原
说明保持不变；本页无独立「额外生命」控件或 producer。空技能槽不显示 rank 沿现实现。

## 部件（`record.kind==='item'`，原 `0x501761`）

无新增 producer。`txtType`/`edtDescription`/`txtDurable` 及类别相关单位字形（含
`shengyutianshu`）沿现实现，不制造新数值功能。

## 进度绘制

新增 `ProgressBar` 的视觉绘制 clip 到 `0..1` 只限制绘图宽度；原数值与原文字不 clip。

## 未验 / 未证边界

原 `0x50109b`/`0x4fbf7f` 的最终像素、色/字形与原设备 HD 表现、`prgLoadingTime` 文本在进度条上的
原绘制表现、各记录字段在 Web `OwnedRoleRecordData.fields` 的实际填充范围、原 server 交易授权与
对战最终属性均未证；本页聚合是原 Trade 显示投影，不等于战斗最终属性。既有采用参数与 source 边界保持；本 BV 一次集中静态代码走查已完成，该走查不是页面/联机/HD/精准 server 实测。本批无 native 执行对照，
无页面/联机/HD 实测，未宣原设备像素或原 server 已恢复。
