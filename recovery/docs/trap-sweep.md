# 扫光光地面陷阱消费者

FUNC-14/M4-10。原item12扫光光价格10金币/10软星，ItemType1、BattleUseMax5、技能12/0/0；原skill12 Trigger1、Target1、Range400、Func14参数全0、Effect19/GA35/tag0/method3。`trap-sweep-source.json/log`逐原item.dat/skill.dat该条记录核对当前发布目录，既有原快捷键/数量初始化/效果通知证据复用，未重跑native。

来源缺口明确为Func14权威执行分派到地面对象删除producer，原服务端写入地址未取得；下一待查入口为原Func14 dispatcher或发送地面对象退役的sender。表Range400不单独证明半径、坐标单位、敌我或消费条件。当前合同明确重建为self XZ半径400世界单位、当前room有效3003全阵营清除；无目标拒绝不扣，CAS成功后删除，不解除已触发角色束缚、不heal。

数值线owns `battle/items/trap-sweep.ts`纯selector及专属rules/source/network/docs，主线owns trap-sweep-use.ts、Shop12和acceptInput正式接线。稳定接口`selectSweepTraps(traps,actor,now,range)`只读取对象，按item3003/expiresAt>now/XZ平方距离<=range²返回原引用并保持原顺序；range取实际skill表，时间取服务端毫秒。`readTrapSweepRule()`校验原12绑定/trigger/target/Func14，返回实际Range。选择模块不扣库存、不写ground数组、不发事件。

`trap-sweep-rules.json/log`纯合同通过：400边界包含、外侧不选、期限等号排除、全owner/team、Y忽略、空对象/未实现3002、引用顺序与无HP/束缚/正buff写入。模块不证明原Func14实现或正式业务。

主线`trap-sweep-use.ts`正式useItem资格及CAS-first删除、Shop12开放已接入，`trap-sweep-authority.json/log`核拒绝/失败/异常/成功/重复/生命与既束缚保持；`trap-sweep-ammo2012-production-server-build.log`服务构建通过。

`tests/trap-sweep-network.cts`首次普通业务raw `trap-sweep-network-2026-10-05T02-40-07-892Z.json`为PASS。复用真实BUYtank3/pet2与3003剩余一份checkpoint，target真实BUY12×2/消费品槽4。正常双Ready，owner放置3003，target在XZ179.725世界单位按键5清除；tick2→3两端ground从1→0、HP700保持、itemUsed12 value1与首槽通知完整双同，库存2→1。再次普通按键拒绝附近无夹子，仍1。三个共同tick完整players与groundTraps相等，目标itemUsed及itemRejected消息双同；双方Leave带roomId/round1完整成功回执。模拟tick、服务器时间、接收墙钟分别保留，未新原生库存或重启读证。`trap-sweep-player-accepted.json`已由主线有限接受。

旧trap移动限制与用药/托管实际直接引用，不重控制suite、重启或未知ground类别。当前仅一个有效3003对象；400边界/全阵营为纯模块合同，既束缚保持为authority局部规则。表现19/GA35真实可辨、全部trap分类/原权威语义、AI扫除策略及父项保持开放。
