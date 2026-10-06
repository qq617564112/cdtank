# 捕兽夹3003原消费者与待接合同

范围：FUNC-03/FUNC-12/M2-03，限定item3003，不扩地雷、果酱、软木塞、宠物10461或旧3001炸弹。原执行取证见trap-function-entry-source.md；UMsgSkBomb独立世界显示接收器不是本合同的陷阱producer。

## 可确认部分

- item3003：class4、Money10/Coin10、BattleUseMax10、技能3003、D3模型3003。
- skill3003：Trigger1/Target1/Range80、Func12参数T30/X30/Y4001/Z3003。参数值及字段地址可确认，其服务端语义/单位尚不能确认。
- skill4001：Trigger1/Target1/Range80、Func3.T5；数值属性全0，Effect112/SE44及Effect17/SE16。是否首槽/次槽与施放/结束对应不能仅由字段猜定。
- 标记9为uint8直行许可计数，不是bool异常。record+125与role+369计数下降的原观察者调用4001；直行command1/2受flag9，原地车体转向command3/4受flag10，混合command5–8要求两者。独立炮塔与开火不是该移动许可的消费者。

## 重建权威边界

缺原server Func12对象创建与Func3计数生产者。待接设计采用正常class4请求和CAS持久消费后创建ground对象；其位置、敌我过滤、单次触发、对象销毁及死亡/离房/再战清理属于重建。若采用Func12.T作为秒、X作为世界触发半径、Y作为作用技能及Z作为模型选择，也必须逐项登记为重建解释，而不是原单位或executor恢复。

作用规则必须与实际原许可合同一致：阻断直行时，玩家仍可A/D原地转车体、方向键独立转炮塔及开火；前进/后退或与车体转向混合输入的位移受拒绝。不能误用flag8 stun冻住全部车体控制。

标记计数恢复采用明确重建政策：原431dbf非零写入只加1，false写入清整个byte，不能通过setFlag(9,oldValue)恢复原计数。原observer支持2→1等下降，故不能静默把任何正计数清0并统一恢复1。主线已确认每trap扣1，正常存活status2到期恢复currentCount+1；不叠加不刷新，计数必须>0才触发。死亡/roundreset仅丢弃状态，由life初始化flags。不覆盖其它来源期间对计数的修改。

期限若按Func3.T5为5server秒，是重建时基。实际运动数学仍使用既有f32模拟dt与原限幅/单位，deadline用server时间；验收分别记录simulation/server/wall，不能用墙钟到期替代模拟输入证明。

## 具体归属与首次验收

数值线拥有新battle/items/trap-restraint.ts独立作用规则、专属rules/network/source/doc/output；主线拥有ground对象、CAS/Shop、player-state/World/protocol和正式接线，模型表现归相应专线协调。仅共享caller或跨线接口等待归属确认，既有源映射可独立准备。

真实取得必须零拥有资金profile-only→TankShop/PetShop BUY及选择→Shop BUY3003→Kitbag槽2–4→普通placeTrap。正常输入放置后撤离，另一玩家正常移动进入并受到许可阻断；比较前后距离、原地车体/独立炮塔与fire仍有效、期限恢复、双端一致、数量消耗及正常Leave。若ground对象/原来源资格尚未接通，不用活跃位置注入、原生技能fixture或World模块测试替代该业务。

独立规则模块已接入root正式对象provider/取得链；首次真实购买与普通进入/许可恢复见tank-purchased-trap-restraint-network.md和tank-purchased-trap-restraint-player-accepted.json。仅当前组合有限业务，不能勾FUNC-03/FUNC-12/M2-03父项。

## 稳定模块接口与局部范围

`readTrapRestraintRule()`只从实际3003物件→3003技能Func12→Y4001技能Func3读取参数，未设置车型最终常量。`applyTrapRestraint(target,now,permission)`要求存活/status2、没有当前作用、来源计数>0，原子provider写count−1再保存状态。`expireTrapRestraint`在server deadline前不变，存活status2正常到期通过provider写currentCount+1并按uint8回绕；`resetTrapRestraint`不写计数。缺record/计数源时丢弃作用，不造许可。

状态为 `{itemTableId:3003,skillId:4001,expiresAt,removedMovePermission:1}`。provider显式提供实际array33 `readMovePermissionCount():number|undefined`、`writeMovePermissionCount(count):void`，其读写/通知由root权威实现，模块不触combat-state或projection。返回实际change kind/state/permissionChanged/count，供正式接线选择事件，模块不发布网络事件或表现。

FUNC10注射解除扩展：`clearTrapRestraint(target,permission)`在存活status2且有束缚时，将当前uint8许可计数加回该trap贡献1并回绕，写一次后删state，返回kind `cleared`；不等expiresAt。不覆盖其他来源对当前计数的改动。失活或计数源缺失沿reset丢状态，不恢复旧许可；重复清除无读写。与自然expiry共享最后恢复步骤，原deadline和失活判断顺序不变。注射可解除该状态、消费授权及事件时序是明确重建政策，不由原Func10文字推定server实现。`trap-restraint-clear-rules.json/log`仅七个新增清除条件通过，包含其他贡献、uint8回绕、重复/缺源/失活及HP/正buff/技能槽保持；未重跑原13条件与120原观察者，也不将module作为正式CAS或普通用药验收。

`tests/trap-restraint-rules.cts` 13条件PASS_MODULE_ONLY；来源定义、1/2/255原byte计数、原移动门禁、重复不刷新、exact deadline、死亡/状态/round/撤源清除、其它来源更新4及255后恢复，以及HP655/16槽保持。专属strict NodeNext类型exit0，`trap-restraint-{rules.json,rules.log,types.log}`。仅独立模块，未把该局部资格与计时模拟包装为真实BUY/进入/双端业务。完整原计数producer与Func12参数语义保持未恢复。

首个正式网络runner为 `tests/tank-purchased-trap-restraint-network.cts`，专属类型检查exit0。root ground provider稳定后在独立3297执行真实购买首验，使用正式trapPlaced/trapTriggered/trapRestraintEnded与match.groundTraps/players.trapRestraint。普通放置/本人前移撤离/目标转向前进进入、前后组合拒绝、原地车体/炮塔/开火、5秒权威期限与恢复、157共同tick和双正常Leave均有实际证据。原raw末尾持久下标断言FAIL保留，由同次原生SQLite只读stock1/槽1证明及独立analysis组合验收；无第二次网络run。详见专属索引与文档，不扩原对象规则/图声或完整父项。

仪器等待两端PLAYING快照均包含两位实际玩家后发输入；失败时同样保存已发送的全部普通输入。每个事件分别保存接收墙钟、之前的快照tick/serverTime及事件索引，和完整双端快照一起供复核。此前快照时间不是事件精确发生时间；5秒deadline以正式trapRestraint.expiresAt核对全部active快照及首到期tick，不用事件接收墙钟替代。
