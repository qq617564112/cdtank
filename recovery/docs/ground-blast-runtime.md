# 小型/中型爆炸地雷正式运行规则

本任务只接 `skill3007` 与 `skill3008` 的普通取得、放置和真实爆炸结算。`item3007`“定时闹钟”仍是
`groupRestraint`，本实现不修改其价格、技能引用、地面模型或触发行为。

## 原表事实

| 来源 | 原字段 |
| --- | --- |
| `skill3007` | 小型爆炸，Trigger1/Target4/Range200，Func15 `Y3010`，末端 `skill3010` Func2 HP-100。 |
| `skill3008` | 中型爆炸，Trigger1/Target4/Range200，Func15 `Y3011`，末端 `skill3011` Func2 HP-200。 |
| item caller | 原 item 表没有引用 `3007/3008` 的普通物品；两个技能的正式旧 server 取得和分派来源未恢复。 |

采用规则：新增普通商城陷阱物品 `item3008`“小型爆炸地雷”和 `item3009`“中型爆炸地雷”，分别引用
新增 placement `skill33007/33008`，`runtime.trap` 使用 `blast`。这是按原技能名、爆炸宽度和同族
category4 地雷链推断的重建来源，不宣称原 item/技能表已有这些记录。

## 取得与配置

两个 item 沿用 `item3002` 地雷的普通 category4 规则：`itemType=4`、`inventoryCategory=2`、
`getMethod=2`、`BattleUseMax=10`、`cpuAvailable=true`、`trade=1`，普通商城正价 `10 money/10 tokens`，
有限配给 `shopSupplyCount=10`。资源分别复用 `item3002` 和 `item3001` 的已解析地面模型与图标。

玩家通过现有普通商城购买后进入 owned 库存，Home Kitbag 的 weapon 槽1..3配置后获得 battle 数量；
对局内普通 `placeTrap` 请求沿用现有 category4 门控、CAS 扣减、热键配置和地面对象快照，不新增隐藏
grant、CPU 专用库存或免费商城。

## 放置与爆炸

`skill33007` 的 Func12 为 `t30/x30/y3007/z3002`，`skill33008` 为 `t30/x30/y3008/z3002`。采用单位：

- `t=30` 秒为地面对象期限；
- `x=30` 为敌方接触触发半径；
- `z=3002` 为既有 `03002` 地面模型；
- `blastWidth` 分别为 `100/150`，对应原 `skill3007/3008` 说明与末端 HP `-100/-200`。

`advanceGroundBlasts` 只接受 `itemTrapHandler(itemTableId)==='blast'` 的真实已放置对象，按各自 item
解析 placement、爆炸源技能和末端伤害。敌人进入触发半径或30秒到期后移除一次对象，在 trap 世界
位置发出 `playSkillEffect`，再按中心 XZ 方形宽度结算真实 `damagePlayerDirectly` 链；到期爆炸不要求
接触目标即可结算范围，同队与自身沿现有 contact mine/mode 资格，不命中友军，死亡、绘声、免伤、
统计和模式终局继续走 World 现有 callback。

`world.ts` 在运动前后推进真实爆炸对象；每次爆炸通过现有 `runCombatResolution` 完整处理范围伤害后统一判断终局。共享 `index.json` 载入两个有限陷阱和两个放置技能定义。

## 边界

placement技能 `33007/33008` 与 item `3008/3009` 是明确采用的重建记录。原 server 的真实 writer、
原生 Func15 全分派、实际商城/配置/对局绘声和持久重启未在本批实测；静态代码走查不替代这些验收。
