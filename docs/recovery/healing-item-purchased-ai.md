# 已购宠物生命来源的Autopilot小包恢复

M2-01/I01补充真实取得到独立生命来源的自主治疗消费者。tests/healing-item-purchased-ai-network.cts复用真实BUY3/pet2原生检查点，新Shop请求购买小包1一件并配置Kitbag槽4，在普通mode4/map7双账户房通过正常Ready进入。

pet2拥有记录+2c提供700生命上限，技能1提供HP200。P2用普通炮塔及射击输入使P1自然存活受伤至475/700，停射后等待12步，再由P1正常开启Autopilot。既有AI选择策略自主使用小包，生命475→675、上限700，双端指定itemUsed1/value200完全相同。P1客户端PlayerInput为0，库存1→0；关闭Autopilot后，两端round1 Leave正常成功。

139次共同PLAYING观察的完整players相等。原始记录为recovery/output/healing-item-purchased-ai-network-2026-10-05T04-57-12-386Z.json，同前缀-server.log保留完整服务日志；摘要为recovery/output/healing-item-purchased-ai-player-evidence.json。3331服务退出且无监听，临时数据库已清理。当前联机断言PASS，主审状态由摘要mainReview登记。

范围仅真实购买角色独立lifeReady到既有AI治疗入口。宠物拥有不推导boundGear；自用目标、服务器资格与CAS消费仍为明示重建规则，原Func2分派与完整伤害未恢复。普通伤害仅提供受伤前提；原效果、AI策略、两局、保存和重启证据直接复用。
