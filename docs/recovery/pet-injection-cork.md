# 注射剂解除3005开火束缚

FUNC-10/FUNC-05/I03-B/M2-02限定普通手动消费。`pet-injection-cork-player-evidence.json` 引用首raw `pet-injection-cork-network-2026-10-05T03-43-51-003Z.json`，runner为tests/pet-injection-cork-network.cts。

复用真实BUY3/pet2与余1软木塞的原生SQLite checkpoint，目标正式BUY注射剂×2/合法slot4；普通放置、敌方接触及use5。没有活跃状态写入。tick49 count0→tick50清state/count1，早于原期限4918ms；HP/maxHp保持700，库存2→1，重复无异常拒绝仍1。fresh普通fire消耗7/7→6/7；旧期限后只有一次结束事件。150共同完整players同步，trigger/end/itemUsed指定事件双同，双round1 Leave成功。模拟tick50ms、各段服务时间及墙钟详见raw，清除间隔1tick=.05模拟秒/82ms服务/83ms观测墙钟。

原flag11开火门禁及3005/4003字段来源复用trap-fire-restraint-source，生产CAS-first/clear authority复用pet-injection-cork-authority。地面触发/计数贡献/期限与注射解除属于明示重建；本片不覆盖AI、组合异常、118GA20、原生持久重启或全部原Func10恢复。
