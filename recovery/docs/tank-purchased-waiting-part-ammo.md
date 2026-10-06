# 等待阶段部件装配的普通弹匣来源刷新

M2-02/M6-06首次真实取得到WAITING装备刷新消费者。tests/tank-purchased-waiting-part-ammo-network.cts复用真实BUY3/pet2原生检查点，正常BUY15012一件但未装，普通mode4/map7入房保存旧tank3普通容量7。P1正常Ready、P2仍未准备，正式Equipment PART0装配真实新实例；准备名单P1→空，再正常双Ready进入对局。

统一源读取实际tank3的+58/+5c/+60、普通技能2001/4020，以及实际部件15012→13092的MaxBullet6/LoadTime50；原限幅使容量7→9，已存在源公式normal1.5/last6.75。本片实际开局弹匣9/9、普通一次fire后8/9，访客普通7/7保持。末发与正常间隔数值为来源字段，短片未测其计时，直接复用tank-purchased-part-capacity-network的旧9发/末发/补弹验收。

两次共同PLAYING完整players观察与指定一次fire事件双同，两端round1 Leave正常成功。正式Inventory回执保部件数量1/state2，Equipment QUERY保槽0同instance4，其他槽0。本片仅普通装配、准备取消与首弹匣刷新，不宣连续对局、性能或持久重启。

原始记录tank-purchased-waiting-part-ammo-network-2026-10-05T05-27-41-050Z.json及同前缀-server.log；摘要tank-purchased-waiting-part-ammo-player-evidence.json待mainReview原位登记。3337无监听、服务与临时库清理完成，无活跃来源/位置/HP/库存注入。原账户WAITING装备源和取消准备合同复用，拥有初值/装备授权/服务端弹匣初始化继续明示重建，完整M2/M6父项保持未完成。
