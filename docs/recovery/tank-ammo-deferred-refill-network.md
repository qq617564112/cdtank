# 普通空弹匣跨特殊弹选择的延迟补弹

当前 `roles/ammo-magazine.ts` 保存普通剩余量与 `refillAt`。末发后选中特殊弹时，`advanceDefaultAmmoMagazine` 保留到期请求，直到2001重新被选中且独立弹匣资格成立才按当前计算容量补弹。这是现有明确重建配给政策，数值容量/间隔沿原公式；没有新增特殊弹匣补给规则。

`tests/tank-ammo-deferred-refill-network.cts` 准备当前正式多人消费者首次验收：复用实际BUY3/pet2的原生checkpoint，在隔离副本上正常BUY2011×1/Kitbag槽1；普通输入打空2001，期限前选未发2011，跨原普通期限后特殊量仍1；普通输入切回2001应补满当前容量，新射击扣1后继续五tick不能再补满。保存同tick完整players、核心事件、API库存与双round1 Leave。无活跃状态注入、生产修改、特殊发射、伤害或绘声声明。

既有 `tank-ammo-authority-sol.cts` 在补满普通弹匣后才切特殊弹，旧主动切回实际从普通部分弹匣开始；特殊库存耗尽退回验收也不构成本分支。此处只补尚无实证的pending refill与弹种选择交互。

## 实际结果

`tank-ammo-deferred-refill-network-2026-10-05T15-47-10-203Z.json` 为有限PASS。tick182普通0/7与末发4.5秒，183选未发2011量1，277跨原期限仍1；278普通输入回2001并补7，279新普通射击6/7、间隔1.5秒，284仍6/7，无二次补满。特殊库存API仍1，特殊发射/消费均0。

284个共同键均唯一，完整players相等；8个目标fire事件双端一致。两条正常round1 Leave成功，3587编译服务正常退出且监听为空。actual session58847 exit0，专属严格类型session93987 exit0，日志 `tank-ammo-deferred-refill-network-types.log`。封装 `tank-ammo-deferred-refill-player-evidence.json` 已有限主审，回链 `tank-ammo-deferred-refill-root-review.json`，状态 `PASS_FINITE_DEFERRED_ORDINARY_REFILL_SPECIAL_SELECTION_DUAL_NETWORK_SCOPE`。

本片普通末发到切回补满分别为4.8模拟秒、4.816服务器秒、4.822接收墙钟秒；原4.5秒期限跨越期间保持特殊选择，切回是新的正常输入，不将这组耗时解释为补弹延迟性能。tick183–277所见特殊量均1。

## 范围

现savedcount/refill producer沿明确重建政策，原公式未改变。没有特殊消费、图声、重启或全部车型组合声明。首建房拒绝证据 `tank-ammo-deferred-refill-network-2026-10-05T15-44-59-732Z.json` 与完整serverlog保留，0快照范围不进入对局验收。
