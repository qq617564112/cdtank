# 普通注射解除果酱转向束缚

FUNC-10/M4-10-I03-B/M2-03。专属代码 `tests/pet-injection-jam-network.cts`、证据 `pet-injection-jam-player-evidence.json`，主线审查后原位登记。纯规则与来源复用trap-turn-restraint、旧3003注射CAS-first合同；本片不改生产代码，不重正常5秒自然解除、原115表现或旧异常全套。

真实BUY3/pet2/3004余1的原生checkpoint提供合法账户和槽1，目标账户正式Shop BUY注射×2、Kitbag槽4；普通放置、敌方输入进入后，目标普通use5提前清4002。没有设置活跃位置、HP、flags、事件或胜负。

首次raw `pet-injection-jam-network-2026-10-05T03-20-02-019Z.json` PASS：tick49转向count0，expiresAt1791170410514；tick50/serverTime1791170405563正常注射清state，trapRestraintEnded4002/value1，比原期限早4951ms。HP/maxHp仍700，无治疗；库存2→1，再次无异常使用被拒绝、量仍1，成功itemUsed不重复。

人工新车体转向tick50→55产生0.1702rad且位置不移，0.25模拟秒、0.251服务秒，输入采样墙钟0.223秒。该墙钟端点是收到上一快照后的请求时刻，不与服务tick严格对齐；本片只证明普通转向恢复，不作新的实时转速校准。原转速公式与控制映射沿已接受同来源证据。超过旧expiresAt后仍无state，只有一次end，不能再恢复第二份许可。

151共同tick完整players双同，指定trigger/end/itemUsed在两端完全相同，双round1正常Leave；3310无监听。库存证据为正式API回执，临时库已清，本片无原生库存/真实重启证据。只覆盖当前手动提前解除4002，AI、组合异常、原server计数producer、图声与完整父项保持开放。
