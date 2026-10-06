# 已购宠物生命来源的Autopilot大包恢复

M2-01/I02真实购买角色的独立lifeReady到Autopilot大包治疗消费者通过。tests/healing-large-feed-purchased-ai-network.cts复用真实BUY3/pet2原生检查点，正式Shop新请求BUY2一件并配置Kitbag槽4，普通mode4/map7双账户Ready入场。

原已购pet2的owned+2c提供700上限，技能2的HP字段为400。P2普通瞄准/射击使P1存活受伤至295/700，停射等待12步后开启P1 Autopilot；既有选择策略自主使用大包，生命295→695，上限700，库存1→0。P1客户端PlayerInput为0，双端指定itemUsed2/value400相同，随后关闭托管、两端round1 Leave成功。

319次共同PLAYING观察完整players相等。治疗前后快照分别tick318/319；模拟、服务器和墙钟观察差分别保存在healing-large-feed-purchased-ai-player-evidence.json，观察差不等同AI决策延迟。原raw为healing-large-feed-purchased-ai-network-2026-10-05T05-02-02-355Z.json，完整服务日志同前缀-server.log；3332服务及临时库已清理，无监听。联机断言PASS，主审另在摘要登记。

已完成I02的World完整400、旧CPU215限幅治疗、原效果与两局/保存直接复用；本片仅补真实购买角色独立生命来源下AI完整400的网络支路。pet拥有不等同boundGear，原Func2目标分派与服务端消费producer仍为明示重建。自然原型命中只提供受伤前提，不证明原最终伤害；不重开I02或关闭完整规则父项。
