# 战车改装客户端业务采用合同

M6-03 / UI-33。本合同把原 `49393e` 火力/装甲改装请求、`413cef` TankUp manager、`43b911` 表装载、`3f94/3f95` 消息和 `495970` 确认消费者，收束为可在现账户、Home、战斗属性消费者上直接实施的单一方案。

来源事实只覆盖费用、请求字段、原确认写入顺序、原 Home 两入口、24 个改装弹窗控件及现生产接点。原服务器结果采样、返回属性/加成生成和 owned 启用 producer 未恢复。以下“采用规则”明确属于本项目 Web 重建政策，不声明原服务器已恢复。

## 已发布升级表

`recovery/output/verified/tables/tankup.json` 直接来自 `Data/table/tankup.dat`，列为：

| 原列 | 已发布字段 | 当前采用偏移 |
| --- | --- | ---: |
| 等級 | 目标等级 | +0xc |
| 花費金錢 | 金钱比例 | +0x10 |
| 花費創意點數 | 创意点 | +0x14 |
| 失敗率 | 失败率 | +0x18 |
| 成功率 | 成功率 | +0x1c |

完整 25 行如下。成功率和失败率保留字面值，不归一化、不改写。

| 等級 | 花費金錢 | 花費創意點數 | 失敗率 | 成功率 |
| ---: | ---: | ---: | ---: | ---: |
| 1 | 3 | 20 | 0 | 100 |
| 2 | 3 | 20 | 0 | 100 |
| 3 | 5 | 30 | 10 | 89 |
| 4 | 5 | 30 | 0 | 80 |
| 5 | 7 | 40 | 20 | 75 |
| 6 | 7 | 40 | 0 | 60 |
| 7 | 9 | 50 | 30 | 57 |
| 8 | 9 | 50 | 0 | 40 |
| 9 | 9 | 60 | 40 | 33 |
| 10 | 9 | 60 | 0 | 20 |
| 11 | 9 | 70 | 95 | 100 |
| 12 | 9 | 70 | 95 | 100 |
| 13 | 9 | 80 | 95 | 100 |
| 14 | 9 | 80 | 95 | 100 |
| 15 | 9 | 90 | 95 | 100 |
| 16 | 9 | 90 | 100 | 0 |
| 17 | 9 | 100 | 100 | 0 |
| 18 | 9 | 100 | 100 | 0 |
| 19 | 9 | 110 | 100 | 0 |
| 20 | 9 | 110 | 100 | 0 |
| 21 | 9 | 120 | 100 | 0 |
| 22 | 9 | 120 | 100 | 0 |
| 23 | 9 | 130 | 100 | 0 |
| 24 | 9 | 130 | 100 | 0 |
| 25 | 0 | 0 | 0 | 0 |

采用等级域为当前等级 `0..24`，目标行为 `1..25`。`25` 是终表哨兵，不是可继续改装的下一级；当前等级 `24` 及以上没有可执行改装。等级存储在 owned `+44` 或 `+54`，确认线路宽度为 16 位。失败降级不得低于 `0`。

## 直接来源事实

### Home 两入口与 owned 字段

原 `myhome_panzerpage.xml` 的战车详情区域 `tankeshengjiqu` 有两个真实入口：

| 入口 | 父级与矩形 | 图片 | 实际字段 |
| --- | --- | --- | --- |
| `btnModifyFire` | `tankeshengjiqu`，`l:0 t:110 r:151 b:135` | normal `huoli2.tga`，hover `huoli1.tga`，pushed `huoli3.tga` | action `1`，资格 owned `+38` 非零，等级 owned `+44`；子 `txtAttackLevel` |
| `btnModifyPanzer` | `tankeshengjiqu`，`l:0 t:157 r:151 b:182` | normal `zhuangjia2.tga`，hover `zhuangjia1.tga`，pushed `zhuangjia3.tga` | action `2`，资格 owned `+48` 非零，等级 owned `+54`；子 `txtPanzerLevel` |

`txtAttackLevel` 与 `txtPanzerLevel` 都是 `btnModifyFire` / `btnModifyPanzer` 的子控件，相对矩形均为 `l:94 t:5 r:112 b:21`。当前 `apps/web/src/interface/home/home-tank-source-page.tsx` 只把两个入口及等级文本渲染为静态图和文本，尚未绑定上述点击业务。

### 24 个改装弹窗控件

原布局 `myhome_panzerpage_modify.xml` 共 24 个控件。矩形均为父级内绝对矩形。

| 名称 | 类型 | 直接父级 | 矩形 | 文本/图片消费 |
| --- | --- | --- | --- | --- |
| `all` | StaticImage | 根 | `0,0,800,599` | 根容器 |
| `kuang` | StaticImage | `all` | `245,113,445,385` | `tanchukuang9.tga` 及边框九切片 |
| `lblLv` | StaticText | `kuang` | `10,10,40,26` | 原等级标签 |
| `txtLv` | StaticText | `kuang` | `55,10,85,26` | 当前等级 owned `+44`/`+54` |
| `txtValue` | StaticText | `kuang` | `10,30,75,46` | 当前攻值/装甲值 |
| `lblNextLv` | StaticText | `kuang` | `10,68,192,84` | 下一等级标签 |
| `txtNextMinValue` | StaticText | `kuang` | `10,90,90,106` | 下级数值下限 |
| `txtNextMaxValue` | StaticText | `kuang` | `93,90,158,104` | 下级数值上限 |
| `lblSuccess` | StaticText | `kuang` | `10,115,50,131` | 成功标签 |
| `lblNoEffect` | StaticText | `kuang` | `10,128,50,143` | 无效果标签 |
| `lblFail` | StaticText | `kuang` | `10,140,50,156` | 失败标签 |
| `txtSuccess` | StaticText | `kuang` | `70,115,100,131` | 成功率 |
| `txtNoEffect` | StaticText | `kuang` | `70,128,100,143` | 无效果余量 |
| `txtFail` | StaticText | `kuang` | `70,140,130,156` | 失败率 |
| `tiao` | StaticImage | `all` | `248,308,442,329` | `lantiao.tga` 创意点条底 |
| `txtOriginalityExpense` | StaticText | `tiao` | `117,3,187,19` | 创意点费用 |
| `huofeijinengdian` | StaticImage | `tiao` | `18,0,71,21` | `chuangyidianshu.tga` |
| `jinengtubiao` | StaticImage | `tiao` | `4,3,16,18` | `chuangyidiantubiao.tga` |
| `tiao2` | StaticImage | `all` | `248,286,442,306` | `lantiao.tga` 金钱条底 |
| `jinqiantubiao` | StaticImage | `tiao2` | `4,5,17,17` | `dian2.tga` |
| `jinqian` | StaticImage | `tiao2` | `18,0,71,20` | `jinqian.tga` |
| `txtMoneyExpense` | StaticText | `tiao2` | `117,3,187,18` | 金钱费用 |
| `btnModifyTank` | Button | `all` | `257,336,338,379` | normal `gaizhuang2.tga`，hover `gaizhuang1.tga`，pushed `gaizhuang3.tga`，disabled `gaizhuang4.tga` |
| `btnClose` | Button | `all` | `350,336,431,379` | normal `quxiao2.tga`，hover `quxiao1.tga`，pushed `quxiao3.tga` |

`ui.json` 已发布该布局：`ui/layouts/myhome_panzerpage_modify.xml`，24 窗，源文件为 `recovery/output/verified/assets/data/Data/ui/layouts/myhome_panzerpage_modify.xml`。24 个控件的源事件列表均为空，当前 Web 必须显式绑定确认和关闭。

### 费用、请求、确认

原请求只发送 action 8 位和 owned instance 32 位。action `1` 使用 owned `+38` 与 `+44`，action `2` 使用 owned `+48` 与 `+54`。客户端门禁有具名语义：

| 门禁 | 采用错误码 | 含义 |
| ---: | --- | --- |
| 3 | `UPGRADE_TARGET_UNAVAILABLE` | 等级上限、目标行不存在 |
| 4 | `UPGRADE_MONEY_REQUIRED` | 金钱不足 |
| 5 | `UPGRADE_ORIGINALITY_REQUIRED` | 创意点不足 |
| 6 | `UPGRADE_DISABLED` | owned 资格字段为 0 |

费用使用 owned `+24` 对应 Tank 表的 `TankMoney` 和 TankUp 目标行 `花費金錢`：

```text
moneyCost = floor(uint32_low32(TankMoney * tankUpMoney) / 100)
originalityCost = tankUpOriginality
```

原 3f95 回包字段为 action 8 位、instance 32 位、完整 money 32 位、完整 originality 16 位、attribute 16 位、bonus 16 位、result 8 位。当前消费者在 profile 与 owned 实例都存在时，先替换完整 money/originality，再按 result 分支。`result=0` 增加对应等级并写入返回 attribute/bonus；`result=2` 降低对应等级并写入同样两项；其他 result 保持等级和属性。

## Web 采用规则

### owned 启用 producer

owned `+38` 和 `+48` 是资格位，不是 UI 猜测。采用规则如下：

1. 正常 `TankShop BUY` 成功建档时，明确写入 `+38=1`、`+48=1`。这是购买 producer 的重建初值，使新购拥有的火力与装甲改装入口可获得资格。
2. QUERY、SELECT、打开弹窗、页面载入和重连都不得把 0 改为 1。owned 字段为 0 时仍按 source flag 禁用，并返回 `UPGRADE_DISABLED`。
3. 已有导入记录或旧账户记录若为 0，不做自动迁移，也不在升级事务内偷写资格位。此类记录可在操作前通过既有 `replaceRoleRecords` 的显式导入路径取得正确字段；公开升级 RPC 不承担资格授予。
4. 交易、保养、迷彩和普通战斗不改写这两个资格位。

正常确认拥有或购入记录的可操作入口是：Home 战车页选中该 owned 实例，`+38/+48` 为该 action 的启用位，点击原 `btnModifyFire` / `btnModifyPanzer`，QUERY 返回可执行 quote，再以 `btnModifyTank` 提交。新购入口由购买 producer 提供资格；普通旧记录的 0 保持可见禁用状态。

### 结果采样

原表结果域采用 100 点整数域，不把成功率或失败率重新缩放：

```text
roll = uniform integer [0, 99]
result = 0  if roll < Success
result = 2  else if roll < Success + Fail
result = 1  otherwise
```

`result=1` 是无效果，不改变等级和两项属性。成功率、失败率始终按表字面显示和返回。若 `Success + Fail > 100`，先匹配成功段，失败段只使用 0..99 中实际剩余部分，不做归一化；这是采用边界，不声明原采样公式。rank3 因而为 0..88 成功、89..98 失败、99 无效果。

### 返回 attribute 与 bonus

采用每次成功或失败按 Tank 表升级上下限生成对应两项：

```text
attackAttribute  += uniform integer [MinAtkUp, MaxAtkUp]
attackBonus      += uniform integer [MinAtkBonusUp, MaxAtkBonusUp]
armorAttribute   += uniform integer [MinDefUp, MaxDefUp]
armorBonus       += uniform integer [MinDefBonusUp, MaxDefBonusUp]
```

成功使用加法和 `result=0`；失败使用同样范围的减法、最低为 0，并返回 `result=2`。无效果返回当前 owned 值、`result=1`。所有返回值截断在 `0..0xffff`。这一生成规则是明确采用政策，不是原服务器返回公式的恢复；它使用 Tank 表的 Min/Max 字段，并让确认值真正写入现战斗消费者。

### 等级与字段宽度

| 字段 | 宽度与规则 |
| --- | --- |
| `action` | 8 位；采用只允许 `1` 火力、`2` 装甲 |
| `instanceId` | 32 位；必须是当前账户 owned equipment `+1c` |
| `level` | 采用域 `0..24`；写入 owned `+44`/`+54` |
| `money` | 32 位完整余额 |
| `originality` | 16 位完整余额；结果超过 `0xffff` 时拒绝事务 |
| `attribute` / `bonus` | 各 16 位；写入 `+3c/+40` 或 `+4c/+50` |
| `result` | 8 位；采用只返回 `0` 成功、`1` 无效果、`2` 失败 |

等级 0 失败不得降到负值。当前等级 24 的目标行 25 为终表哨兵，因此最高可执行升级是 23 到 24；等级 24 及以上拒绝 `UPGRADE_TARGET_UNAVAILABLE`。失败仍执行已接受尝试并扣费。

### 事务与确认顺序

服务端在 `BEGIN IMMEDIATE` 内按以下顺序执行：

1. 校验账户、owned 实例、action、资格位和目标表行。
2. 校验当前等级域及终表哨兵。
3. 计算 money/originality 费用。
4. 校验 money 32 位与 originality 16 位边界、余额和失败降级下限。
5. 扣除 money 与 originality。
6. 采样 result，按 action 和 result 更新 owned 等级与两项属性。
7. 写升级 receipt。
8. 同一事务提交后返回完整 `owned`、`profile`、`confirmation` 和 `replayed`。

任何校验或写入失败都 rollback，余额、两项属性、等级和 receipt 均不改变。费用在成功、无效果和失败三种已接受结果上都扣除，这与原确认先替换完整钱包、再处理 result 分支一致。

客户端收到确认时先应用完整 money/originality，再应用 result 分支和两个 16 位属性。`result=1` 只更新钱包；未知 result 保持等级和属性不变，但服务端合同不产生未知 result。

### WAITING、Ready 与 PLAYING

`UPGRADE` 允许无房间或房间 `WAITING` 提交；`LOADING`、`PLAYING`、`FINISHED` 在账户事务前拒绝，返回 `UPGRADE_REJECTED`，不改余额、owned、等级或 receipt。正常无房间 Home 升级必须可操作。仅当玩家真在 `WAITING` 且本次是新提交（非 replay）成功后，重绑玩家角色来源与装备 profile、从当前玩家的 `room.ready` 移除该玩家并广播房间状态；这样已提交的改装不会被旧 Ready 直接带入开局。QUERY 可在无房间、WAITING、LOADING、PLAYING 和 FINISHED 使用，只读且不改变 Ready。

### receipt 重放与确认 QUERY

`requestId` 是现账户 RPC 的重建幂等键，不是原 3f94 字段。相同账户、相同 `requestId`、相同 `action`、相同 `instanceId` 的重入返回历史 confirmation 和 `replayed:true`，不得再次扣费、降级、升级或重新写属性。历史 confirmation 不重 roll、不扣费、不改 owned；重放响应的 owned/profile 读取当前账户持久状态，historicalConfirmation 只用于结果说明。同一 `requestId` 用于不同 action 或 instance 时拒绝 `UPGRADE_REQUEST_CONFLICT`。

QUERY 返回当前账户完整 owned、当前 profile、action 对应 quote、启用状态、等级、费用、成功/失败/无效果字面和拒绝原因；不返回 confirmation，不创建 receipt。确认 QUERY 与重入相互独立：QUERY 永远读当前持久状态，重入返回历史 confirmation 说明与当前持久 owned/profile。UI 以响应中的当前 owned/profile 替换确认状态；`replayed:true` 时不得把 historicalConfirmation 的旧 money 或属性再覆盖现账户。新提交的 confirmation 与当次已提交 state 一致。

### 保留边界

升级只更新当前账户的一个 equipment role record 及 profile money/originality。必须在同一事务内保留其余 owned 字段、纹理 `+28/+2c/+30`、部件 `+58/+5c/+60`、期限 `+34` 和状态；不得删除或重建购买、交易、维修、迷彩或其它 receipt。不得新增迁移框架、feature flag、兼容 wrapper、哈希或防御性表。

## 现生产消费者

| 位置 | 现事实 |
| --- | --- |
| `apps/server/src/account-store.ts` | `role_records` 保存完整 owned fields，`role_profiles` 保存 profile bytes 与两个字符串；`roleRecords/roleProfile/replaceRoleRecords` 是账户权威边界 |
| `apps/server/src/accounts/tank-shop.ts` | 正常 `TankShop BUY` 创建 owned equipment，当前先把 `+1c..+6c` 清零，再以 Tank 表基础值写 `+3c/+40/+4c/+50` 与部件槽。当前代码把 `+38/+48` 留为 0，本合同要求购买 producer 改为写 1 |
| `apps/server/src/battle-role-sources.ts` | 从 profile 选中 `+a8` 的 owned equipment 实例复制到战斗来源 |
| `apps/server/src/battle/attributes.ts` | 读取 owned `+3c/+40/+4c/+50`、`+34` 等，进入统一角色重算 |
| `apps/server/src/battle/roles/recompute-armor.ts` | 把 owned attack/defense 与 bonus 合成 `attackBase/attackBonus/attackPercent/defense*` |
| `apps/server/src/battle/roles/qualified-shot-attack.ts` | `attack = round(max(0, attackBase * attackPercent + attackBonus))`，真实进入射击伤害 |
| `apps/server/src/battle/projectiles.ts` | 使用同一重算后的装甲/减伤来源 |
| `apps/web/src/interface/home/home-tank-source-page.tsx` | 已读 owned `+3c/+40/+4c/+50/+44/+54` 展示，两入口当前未绑定真实 action |

当前购买建档在 `apps/server/src/accounts/tank-shop.ts` 用 TankTable 的 `TankAtk/TankAtkBonus/TankDef/TankDefBonus` 写确认字段，这是重建未强化初值，不是原 3f95 确认生成。升级成功后，原表确认路径必须以服务端返回的 attribute/bonus 覆盖对应 action 的两项 owned 字段；否则数值只落库、不进入战斗消费者，合同不成立。

## RPC 合同

采用与现账户 TSRPC 模式一致的单一公开 API。以下只定义合同，不在本轮创建 protocol 或 schema 文件。

共享新增 `apps/shared/protocols/PtlTankUpgrade.ts`：

```text
ReqTankUpgrade
  operation: 'QUERY' | 'UPGRADE'
  instanceId?: number
  action?: 1 | 2
  requestId?: string

ResTankUpgrade
  owned: ResOwnedRoles
  profile?: { bytes: number[]; strings: [string, string] }
  quotes: TankUpgradeQuote[]
  confirmation?: TankUpgradeConfirmation
  historicalConfirmation?: TankUpgradeConfirmation
  replayed?: boolean

TankUpgradeQuote
  instanceId: number
  action: 1 | 2
  currentLevel: number
  nextLevel: number
  nextAttributeMin: number
  nextAttributeMax: number
  nextBonusMin: number
  nextBonusMax: number
  enabled: boolean
  moneyCost: number
  originalityCost: number
  success: number
  fail: number
  noEffect: number
  canUpgrade: boolean
  reason?: 'UPGRADE_TARGET_UNAVAILABLE' | 'UPGRADE_MONEY_REQUIRED'
    | 'UPGRADE_ORIGINALITY_REQUIRED' | 'UPGRADE_DISABLED'

TankUpgradeConfirmation
  action: 1 | 2
  instanceId: number
  money: number
  originality: number
  attribute: number
  bonus: number
  result: 0 | 1 | 2
  level: number
```

`nextAttributeMin/nextAttributeMax/nextBonusMin/nextBonusMax` 由服务端派生：按当前 owned 属性/加成与本 action 对应 Tank 表 Min/Max 升级区间计算成功候选边界，并按既有 uint16 规则截断到 `0..0xffff`。UI 的 `txtNextMinValue` / `txtNextMaxValue` 只消费这些报价，不重新计算收费、随机或属性区间政策。当前属性/加成仍从返回 owned 确认字段读取。

QUERY 只校验账户，返回完整 owned、当前 profile 与本账户每个 owned tank 两个 action 的报价。UPGRADE 要求登录，允许无房间或 `WAITING`；`LOADING`、`PLAYING`、`FINISHED` 拒绝。instance 必须 owned，action 合法，`requestId` 匹配现请求 ID 规则。重复 requestId 返回历史 confirmation 并置 `replayed:true`，同时 owned/profile 读取当前持久状态；仅新提交且玩家真在 WAITING 时重绑来源、取消 Ready 并广播。

注册模式沿用其他账户 API：服务端通过 `accountByConnection` 解析账户，通过 `sessionByConnection` 判断房间操作。成功提交后，若玩家在 WAITING，调用现 `world.bindRoleSources` 与 `world.bindEquipmentProfile` 同步战斗来源和 profile，移除 Ready，再广播。

## 文件分配

server/shared 实现者：

| 文件 | 动作 |
| --- | --- |
| `apps/shared/protocols/PtlTankUpgrade.ts` | 新增请求、响应、报价与确认合同 |
| `apps/shared/protocols/index.ts` | 导出新协议 |
| `apps/shared/protocols/serviceProto.ts` | 手工追加 `TankUpgrade` API 及对应类型/schema；保留既有服务 ID、字段与版本增量。不运行协议生成器或协议检查。原表字段与 Web TSRPC 不是原 native opcode 等价。 |
| `apps/server/src/accounts/tank-upgrade.ts` | 新增 TankUp 表读取、费用、采样、attribute/bonus、事务、receipt 与 owned 更新 |
| `apps/server/src/accounts/tank-upgrade-api.ts` | 新增 `TankUpgrade` TSRPC 注册、WAITING/Ready/广播接点 |
| `apps/server/src/account-store.ts` | 新增 `tankUpgrade(accountId, request)` 委托，复用 profile/owned 读写边界 |
| `apps/server/src/accounts/api.ts` | 注册 `registerTankUpgradeApi` |
| `apps/server/src/accounts/tank-shop.ts` | 新购 owned equipment 写 `+38=1`、`+48=1` |

UI/Web 实现者：

| 文件 | 动作 |
| --- | --- |
| `apps/web/src/interface/home/home-tank-upgrade-dialog.tsx` | 新增 `myhome_panzerpage_modify.xml` 24 控件消费者 |
| `apps/web/src/interface/home/home-tank-upgrade.css` | 新增源布局弹窗定位、禁用与状态样式 |
| `apps/web/src/interface/home/home-tank-source-page.tsx` | `btnModifyFire`/`btnModifyPanzer` 改为真实按钮，打开 action 1/2 |
| `apps/web/src/interface/home/home-roles.tsx` | 从已确认选中实例打开弹窗，提交后更新 owned/profile |
| `apps/web/src/network/accounts.ts` | 新增 `TankUpgrade` 薄客户端方法与 TSRPC 错误传播 |
| `apps/web/src/match/battle.ts` | 暴露 `tankUpgrade(request)` |
| `apps/web/src/interface/home/home.css` | 仅在源弹窗需要页面级层级或响应式约束时追加，不改变其它 Home 业务 |

不新增通用分页、branded ID、迁移表、source 未知字段、feature flag 或额外安全层。测试、浏览器验收、协议生成、构建和类型检查不属于本轮。

## Limitations

原服务器结果采样区间、attribute/bonus 生成公式、owned `+38/+48` 原始启用 producer 仍未取得。当前实现采用本合同明确列出的 100 点结果域、Tank 表 Min/Max 增减和正常购买启用位，不声明与未知原服务器逐值一致。

现有账户和导入记录的 0 资格位不自动迁移。真实双端执行、同库重启持久、HD/1:1 精度、原完整 Home 93 控件父项以及 M6-03/UI-33 父项仍需后续正式实现和验收。
