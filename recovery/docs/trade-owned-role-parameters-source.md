# 交易三详情页剩余动态参数原来源与采用接线合同

M5-11 / UI-61/62/63。来源为 `recovery/output/current-exe.asm` 原指令与三份原布局
`trade_tankdesc.xml` / `trade_petdesc.xml` / `trade_partdesc.xml`（`recovery/output/web-assets/ui.json`
同名路径、同名控件）。本文只记原 setter/dispatch、原传入记录/参数/条件、单位与格式，以及
可由已确认 `TradeRecordView.fields` + 本地目录实施的接线合同。不宣原设备像素、原 setter
最终色/字形或原 server 已恢复。

## 三详情页更新入口

三个详情面板都由主交易页对象持有：布局指针分别在 `+0x344`(`trade_partdesc.xml`)、
`+0x358`(`trade_petdesc.xml`)、`+0x3d4`(`trade_tankdesc.xml`)，控件成员连续挂在同一页面对象上。
按所选确认报价记录的 kind 调用对应更新方法，三个方法的唯一输入都是“确认的拥有记录指针”
（战车/宠物 owned record、道具 record），不读发起方 current profile，也不查拥有者账户。

| 页面 | 更新方法 VA | 记录→定义表 | setter |
| --- | --- | --- | --- |
| 部件 | `0x501761` | `413c74(record+0xc)`→`411068` ItemInfo | `[0x5c0240]` 文本 |
| 宠物 | `0x4fbf7f` | `413c83(record+8)`→`411068` PetTable | `[0x5c0240]` 文本 / `[0x5c0128]` 进度 |
| 战车 | `0x50109b` | `413c95(record+0x24)`→`411068` TankTable | `[0x5c0240]` 文本 / `[0x5c0128]` 进度 |

战车页入口 `0x5010bb..0x5010cb` 先调 `42a5b9(manager+0x118, out=[ebp-0x44], record)`，返回后
`out+4=[ebp-0x40]` 即聚合数据指针（下称 `agg`）。`42a5b9` 遍历记录 `+0x58/+0x5c/+0x60` 三部件
物品定义，对每个物品 `+0x108/+0x10c/+0x110` 三技能 id 经 `429714` 累加数值列；`429714` 只
处理被动技能（`skill+0x2c==0`），技能数值列在 `skill+0xe8..+0x154`。25 槽模板由 `42995c(0x19)`
建立、`41896d(slot)` 取槽；槽 7..16 依次为 Atk/AtkBonus/Def/DefBonus/SideDef/BackDef/ItemMove/
ItemTurn/Delay/MaxBullet，对应 `agg+0x1c..+0x40`。即战车详情的聚合只来自该战车自身三部件
物品的被动技能，不含宠物、不含发起方当前档案，也不做 `dataScale` 夹取。

格式常量：`%d`=`0x5c83d4`，`%.1f`=`0x5c418c`，`%.f`=`0x5d4a48`；间隔缩放 `f32 0.1`=`0x5c3370`，
宠物进度缩放 `f32 0.2`=`0x5c4794`，容量进度缩放 `f32 1/6`=`0x5ced40`。

## 战车页（trade_tankdesc.xml）

布局指针 `+0x3d4`。控件成员由构造块 `0x4ffa40` 起逐个绑定，更新块为 `0x50109b`。下表为
该页全部动态控件及其原 setter（含本批不改的四攻防字段）。

| 控件(成员) | setter VA | 原传入/算术 | 格式 |
| --- | --- | --- | --- |
| txtName (0x3d8) | `0x501144` | TankTable 名串（`+0x24/+0x14`） | — |
| edtDescription (0x3dc) | `0x501175` | TankTable 说明串（`+0x40/+0x30`） | — |
| txtAttackLevel (0x3e0) | `0x5013e7` | `record+0x44` | `%d` |
| txtAttack (0x3e4) | `0x5013b1` | `record+0x3c + agg+0x1c` | `%d` |
| txtAttackExtra (0x3e8) | `0x501424` | `record+0x40 + agg+0x20` | `%d` |
| txtPanzerLevel (0x3ec) | `0x501497` | `record+0x54` | `%d` |
| txtPanzer (0x3f0) | `0x501461` | `record+0x4c + agg+0x24` | `%d` |
| txtPanzerExtra (0x3f4) | `0x5014d4` | `record+0x50 + agg+0x28` | `%d` |
| txtPanzerSide (0x3f8) | `0x501514` | `TankTable+0xa4 + agg+0x2c`（`SideDef`） | `%d` |
| txtPanzerBack (0x3fc) | `0x501554` | `TankTable+0xa8 + agg+0x30`（`BackDef`） | `%d` |
| txtMoveSpeed (0x400) | `0x50159d` | `(TankTable+0x84 + agg+0x34 + 2) * 10`（`ItemMove`） | `%d` |
| txtRotateSpeed (0x404) | `0x5015e4` | `(TankTable+0x88 + agg+0x38) * 4 - 1`（`ItemTurn`） | `%d` |
| txtShootInterval (0x408) | `0x501632` | `(agg+0x3c + TankTable+0x8c) * 0.1`（`Delay`） | `%.1f` |
| txtSlot (0x40c) | `0x501668` | `record+0x6c` | `%d` |
| prgLoadingTime (0x410) | 文本 `0x5016b2`、进度 `0x50171e` | 文本 `(agg+0x3c + TankTable+0x8c) * 2`；进度 `(TankTable+0x90 + agg+0x40) * f32(1/6)`（`MaxBullet`） | `%.f` |
| txtInternalPart0 (0x444) | `0x501218` | 由 `record+0x58` 查 ItemInfo 名串，缺表则字面 `Empty`(`0x5d4a50`) | — |
| txtInternalPart1 (0x448) | `0x5012bd` | 同上，`record+0x5c` | — |
| txtInternalPart2 (0x44c) | `0x50135e` | 同上，`record+0x60` | — |
| txtDurable (0x454) | `0x5016f7` | `ceil(record+0x34 / 0x5a0)`（剩余分钟→天） | `%d` |

静态单位与标签（`huoliwenzi`、`yidongdusuwenzi`、`huixuansuduwenzi`、`rotateSpdUnit`、
`fashejiangewenzi`、`cemianzhuangjiawenzi`、`zhuangdanxiuzhengwenzi`、`beimianzhuangjiawenzi`、
`lingjiantanweiwenzi`、`zhuangjiawenzi`、`lblInternalPart`、`lblDurable`）由构造块用字形常量写入，
属已完成的显式单位/原字体范围。

## 宠物页（trade_petdesc.xml）

布局指针 `+0x358`。构造块 `0x4feeba` 起绑定，更新块 `0x4fbf7f`。

| 控件(成员) | setter VA | 原传入/算术 | 格式 |
| --- | --- | --- | --- |
| txtName (0x35c) | `0x4fc0c8` | 记录名串（`4d8e07` 前缀 + record+0x10 名） | — |
| txtHP (0x360) | `0x4fc111` | `record+0x2c` | `%d` |
| edtDescription (0x364) | `0x4fc1e7` | PetTable 说明串（`+0x38`） | — |
| txtSavage (0x368) | `0x4fc15a` | `record+0x34` | `%d` |
| txtLucky (0x36c) | `0x4fc1a3` | `record+0x3c` | `%d` |
| prgLightTank (0x3a0) | `0x4fbfcc` | `f32(PetTable+0x7c * 0.2)`（STankMastery） | SetProgress |
| prgMediumTank (0x3a4) | `0x4fbfe7` | `f32(PetTable+0x80 * 0.2)`（MTankMastery） | SetProgress |
| prgHeavyTank (0x3a8) | `0x4fc002` | `f32(PetTable+0x84 * 0.2)`（LTankMastery） | SetProgress |
| prgCruiser (0x3ac) | `0x4fc01d` | `f32(PetTable+0x88 * 0.2)`（STugMastery） | SetProgress |
| txtSkillName0..5 (0x370+4i) | 循环 `0x4fc22e/0x4fc23b` | 由 `record+0x44+4i` 查 skill 目录名串 | — |
| txtSkill0..5 (0x388+4i) | 循环 `0x4fc266/0x4fc26f` | `record+0x5c+4i` | `%d` |

宠物页四熟练度读的是 **PetTable 定义行**（按 `record+8` 定义 id 查表）`+0x7c/+0x80/+0x84/+0x88`，
不是记录自身的聚合，也没有当前宠物技能/当前战车部件加成。`txtHP` 是该记录 `+0x2c` 的生命值；
本页没有第二个“额外生命”控件或 producer。

## 部件页（trade_partdesc.xml）

布局指针 `+0x344`。构造块 `0x4fed2f` 绑定 `txtType(0x34c)`、`shengyutianshu(0x350)`、
`edtDescription(0x348)`、`txtDurable(0x354)`；更新块 `0x501761` 全量赋值：

| 控件(成员) | setter VA | 原传入/算术 |
| --- | --- | --- |
| edtDescription (0x348) | `0x5017d7` | `record+0xc` 查定义行 ItemInfo 说明串（定义 `+0x34`，长度 `+0x44`） |
| txtType (0x34c) | `0x5017f5` | `4d8366`→`43bda2`→`4d7e58` 取得的 ItemName（定义 `+0x14`，长度 `+0x24`） |
| shengyutianshu (0x350) | `0x501873` / `0x5018fe` | 按 `43bd09(record)` 类别写单位字形（非 1/2 用 `0xb2`，1/2 用 `0x293`） |
| txtDurable (0x354) | `0x501947` | 类别 1/2 取 `record+0x10`；其余取 `ceil(record+0x10 / 0x5a0)`，`%d` |

部件页只承载名称/原说明/天数，`shengyutianshu` 只是类别相关的单位字形标签，不是数值参数。
本页无新增 producer。

## 确认通信字段

原写码器给出对方/己方实际传输的字段，详情只能在这些字段出现时接线：

- 战车 `42195e`：`+0x68,+0x58,+0x5c,+0x60,+0x64,+0x20`(32b)，`+0x3c,+0x40,+0x44,+0x4c,+0x50,+0x54`(16b)，
  `+0x34,+0x1c,+0x24,+0x28,+0x2c,+0x30`(32b)，`+0x6c`(6b)，`+0x38,+0x48`(1b)。
- 宠物 `41e42e`：`+4,+0`(32b)，`+8`(16b)，`+0x84,+0x34,+0x38,+0x8c,+0x80,+0x88,+0x7c,+0x3c,+0x40,
  +0x2c,+0x30,+0x94,+0x28,+0x90`(16b)，随后 6×(`+0x44+4i` base 32b, `+0x5c+4i` rank 32b)，
  `+0x74,+0x78`(32b)。

战车页所需 `+0x24/+0x34/+0x3c/+0x40/+0x44/+0x4c/+0x50/+0x54/+0x58/+0x5c/+0x60/+0x6c` 与宠物页所需
`+8/+0x2c/+0x34/+0x3c/+0x44..+0x58/+0x5c..+0x70` 均在上述字段内。战车页所用的 TankTable 基准列
（`TankMove+0x84`、`TankTurn+0x88`、`TankDelay+0x8c`、`TankBullet+0x90`、`SideDef+0xa4`、`BackDef+0xa8`）
与宠物页所用 PetTable 熟练度列（`+0x7c..+0x88`）为定义目录，不是账户数据。

## 采用接线合同

对确认 `TradeRecordView.fields`（`new Map(record.role.fields)`）与本地目录接线；不新增
QUERY/API/schema/wallet 写，不读发起方 current profile，不查未知技能表身份。任一必需字段缺失
时该控件留空；合法 `0` 显示 `0`；没有源 setter 的进度不添。

采用输入资格（终态）：

- 战车三部件槽 offset `0x58/0x5c/0x60` 必须都有确认值；缺任一 offset 即该项 unknown、相关控件留空。
- `itemId` 为 `0` 是空槽、无加成：不查 0 号物品定义、不当缺确认；任一槽可合法为 `0`，其余槽各按
  自身取值；对应 `txtInternalPart` 名称留空，不写 `"0"`。
- `skillId` 为 `0` 同样为空槽、无加成，不查 0 号技能定义、不当缺确认。
- 非零 `itemId`/`skillId` 在本地目录查不到定义才是 unknown（该 item/skill 不贡献）；非零 `itemId`
  缺目录时相关控件留空。
- 已确认的被动技能定义（`triggerType===0`）中某属性未配置，是该属性按 `0` 累加；单属性未配置
  不等于整组 unknown，也不影响其它属性或其它槽。

战车：`base = HOME_TANK_PARAMETER_BASES[fields.get(0x24)]`（`[TankType,TankMove,TankTurn,TankDelay,
TankBullet,SideDef,BackDef]`）。`itemBonus(attr)` = 按上述资格遍历 `fields.get(0x58/0x5c/0x60)`：
`itemId===0` 跳过；非零 `itemId` 查目录 item，查不到即该项 unknown；对 item 的 `skillIds`，
`skillId===0` 跳过，非零查不到 skill 即 unknown，查到且 `triggerType===0` 则累加
`skill.attributes[attr] ?? 0`：

- `txtPanzerSide = base[5] + itemBonus('SideDef')`（不夹取）
- `txtPanzerBack = base[6] + itemBonus('BackDef')`
- `txtMoveSpeed = (base[1] + itemBonus('ItemMove') + 2) * 10`
- `txtRotateSpeed = (base[2] + itemBonus('ItemTurn')) * 4 - 1`
- `txtShootInterval = (base[3] + itemBonus('Delay')) * f32(0.1)`，`toFixed(1)`
- `txtAttackLevel = fields.get(0x44)`、`txtPanzerLevel = fields.get(0x54)`、`txtSlot = fields.get(0x6c)`
- `txtInternalPart{0,1,2} = 目录物品名(fields.get(0x58/0x5c/0x60))`，槽 `0`/缺目录时名称空
- `prgLoadingTime`：文本 `Math.round((base[3] + itemBonus('Delay')) * 2)`；进度 `(base[4] +
  itemBonus('MaxBullet')) * f32(1/6)`

此投影与 Home 的 `homeTankParameters` 不同：原交易详情无宠物精通项、无 `dataScale` 夹取、无
current profile 门禁，只有该记录三部件物品的被动技能加成。不得把 Shop/Home 的采用公式直接套到
Trade。已完成的四攻防字段（`txtAttack/txtAttackExtra/txtPanzer/txtPanzerExtra`）本批不改。

宠物：`mastery = petShopMastery(fields.get(8))`（原 PetTable `+0x7c..+0x88` 定义值）。
`prgLightTank/prgMediumTank/prgHeavyTank/prgCruiser = f32(mastery[0..3] * f32(0.2))`。定义 id
缺失或目录无该宠物时四进度留空；空技能槽不显示 rank 沿现实现。

进度数值使用原相应 f32 乘数/存储值（战车 `f32(1/6)`、宠物 `f32(0.2)`）；视觉 clip `0..1` 只限制
绘图宽度，原数值/原文字值不 clip。

部件：`txtType/edtDescription/txtDurable` 沿现实现；`shengyutianshu` 的单位字形不新增功能。

## 未证边界

`42a5b9/429714/41896d` 的完整 25 槽语义、技能 `+0xe8..+0x154` 全量数值列目录映射、
`4d8e07/4d8366/43bd09` 完整文本、原 setter 最终色/字形、`prgLoadingTime` 文本在进度条上的原
绘制表现、各记录字段在 Web `OwnedRoleRecordData.fields` 的实际填充范围、原 server 交易授权与
对战最终属性均未证。聚合为原 Trade 显示投影，不等于战斗最终属性。本批无测试/浏览器/build/
typecheck/native/导出，未宣原设备像素或原 server 已恢复。
