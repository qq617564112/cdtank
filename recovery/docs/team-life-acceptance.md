# M4-10-I501：1UP 团队坦克存量验收

1UP（item501 → skill501）通过账户既有库存、快捷槽4和普通 `PlayerInput.useItem=5` 生效。mode1 存活且 status2 的角色在双方团队存量合法且为正时，先提交账户数量 CAS，再消耗本局数量并将本队存量加1；对队存量保持不变。成功事件为 `itemUsed(value=1, skillId=501)`，携带 skill501 的播放通知，现有资源解析选取 Effect12 / SE13。

原始表提供名称、说明“我方坦克存量+1。”、battleUseMax2、skill501 的 Target1 / TriggerType1 / FuncType18（x1/y1）及 Effect12 / SE13。mode1 资格、存量校验、账户 CAS、序列去重和服务器广播属于重建服务规则。item501 双币价格为0，商城列表不出售，购买请求拒绝；验收库存由开局前显式账户 seed 提供。

## 验证结果

`npx tsx tests/team-life-world.cts` 与 `npx tsx tests/team-life-network.cts` 均 PASS。

World 使用 qty3 的既有账户物品、快捷槽4、三个真实 CPU；两局均走普通输入施放，随后通过 CPU 普通移动、瞄准、开火自然结算。战场 HP、位置、胜负、phase 和存量均未被测试写入。

| 自然对局 | 实际命中事件 | 自然死亡事件 | 本队死亡 | 施放前存量 | 施放后存量 | 最终存量 | 剩余账户数量 |
| --- | ---: | ---: | ---: | --- | --- | --- | ---: |
| 1 | 333 | 47 | 31 | [30,30] | [31,30] | [0,14] | 2 |
| 2 | 326 | 46 | 31 | [30,30] | [31,30] | [0,15] | 1 |

每次死亡均检查目标队伍存量恰减1；每局死亡状态下施放不消费。每局 battleQuantity 初始化为2，再战账户库存从2继续消费至1。重复输入序列和非mode1均不消费。真实账户 CAS 使用不匹配的 expectedOwned 验证保存拒绝时本队存量和库存不变，成功回调中确认存量修改发生在账户提交之后。账户库关闭并重开后剩余数量1、快捷槽4和原库存字段保持。

网络验收启动独立 `:3182` 服务和两个不同账户，以普通 Account / CreateRoom / Join / Ready / PlayerInput 完成施放。两连接收到相同成功事件，同一 tick 的团队存量一致；本队加1、对队保持。非mode1请求、重复序列、无库存的另一账户均未额外消费。商城查询排除501且购买501失败。真正终止服务进程并以同一数据库启动后，账户数量2、快捷槽4恢复，另一账户仍无库存。退出时断开客户端并终止子服务。

证据：`recovery/output/team-life-world.json`、`recovery/output/team-life-network.json`。Effect12 / SE13 资源与生命周期专项见 `recovery/output/team-life-effect.json`。

## 限制

本次为 World 与真实网络服务验收，未提供浏览器画面或设备音频播放证据。Effect12 树内 ww051 原始声音文件缺失，现有资源缺失行为和最小恢复入口记录于效果专项证据；SE13 选择不受该资源缺失影响。
