# 托管解除捕兽夹束缚

FUNC-10/M4-10-I03-AI/M2-03。主线owns cpu/items.ts与controller.ts，ItemActor/Actor增加真实TrapRestraintState，并将既有注射选择资格扩为burn、ammoSlow或trapRestraint。沿既有普通useItem输入和真人CAS执行，不改选择优先级、移动、射击或原flag门禁。自主用药策略及trap异常资格仍为重建，非原AI算法恢复。

本线owns `tests/pet-injection-trap-ai-rules.cts`与`tests/pet-injection-trap-ai-network.cts`及专属证据。九个新增局部条件已通过`pet-injection-trap-ai-rules.json/log`：合法注射槽5/8、有束缚但未消费或清状态、死亡/失活/无trap/无owned/无battle库存/错误物品/未配置均不选择。原burn/slowAI已接受范围直接复用，不复跑长局。

实际使用真实BUYtank3/pet2 checkpoint及owner剩余真实3003槽1，target正常BUY注射剂3×2、配置槽4。普通陷阱放置/撤离/目标进入后才开启本人Autopilot；target不发送人工用药。`pet-injection-trap-ai-network-2026-10-05T02-31-31-964Z.json`为PASS，完整server日志同前缀保存。束缚tick49、自主解除tick51，早于deadline4900ms；trapRestraintEnded count1、itemUsed3完整消息双同，HP700保持，库存2→1。五tick内没有再次消费；disable后人工递增序号普通前进5tick距离32.504，旧deadline后无状态且只有一次结束事件。151共同tick完整players一致，双Leave带roomId/round1完整成功回执。模拟tick、服务器与墙钟分别保存。专属`pet-injection-trap-ai-player-accepted.json`待主线亲审。

首raw `pet-injection-trap-ai-network-2026-10-05T02-30-35-674Z.json`整体FAIL保留，其中自主用药主段有效；人工接管runner错误重置序号为0，后续1/2/3低于之前人工6而被正式acceptBattleInput忽略。configureBattleAutopilot只重置独立autopilotInputSequence，人工序号应保持递增。定向复验仅修runner序号，不修改生产输入门禁。旧burn/slow长局与原规则未重跑。

真人trap cure主段复用`pet-injection-trap-player-evidence.json`，其中末Leave仪器缺round导致整体FAIL的范围限制保持；AI新runner显式传当前round，不以新房退出冒充旧片离房。未扩组合burn/slow/trap实际、重启、声音或原AI来源；父项保持开放。
