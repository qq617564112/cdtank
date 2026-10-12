# M2-02 三车实时上界与正常离房补验

`tests/tank-three-models-ammo-realtime-network.cts`只补旧104/154/157未通过的实时上界及未执行的正常Leave。小勇士与其余17车有效证据直接复用，未执行原native或全车型检查。一个隔离正式service顺序运行三个mode4/map7双人房；各认证账户起始空拥有、无profile，正常CreateRoom请求实际定义ID，回执和PLAYING tankId确认同车型。当前`accountBattleBinding.roomTankId`无profile返回请求ID，有profile必须解析实际owned；本次没有导入profile/owned或注入活跃状态，是正式定义分支，不称普通BUY配装。

普通2001/4020通过统一`recomputeRoleAmmo`读取实际TankDelay/TankBullet，有限9发持续普通输入→停火末发装填→补满→fresh输入消费一发→双端→正常Leave。没有硬填最终间隔。模拟tick50ms、服务startedAt/serverTime及接收wall各自记录。普通服务/墙钟间隔与末发补弹服务/墙钟都采用参数+.15秒上界；原f32绝对deadline投影允许1ms误差，连续开火另检第一可用tick未遗漏。

原始证据`tank-three-models-ammo-realtime-network-2026-10-04T21-36-12-165Z.json/.log`整体PASS_AMMO_SCOPE_ONLY，专属strict类型`tank-three-models-ammo-realtime-types.log` exit0。

| tank | 原普通/末发秒（近似） | 普通server范围秒 | 普通wall范围秒 | 末发server/wall秒 | 共同tick | 两次Leave墙钟ms |
| --- | --- | --- | --- | --- | ---: | --- |
| 104 | 2.3 / 6.9 | 2.312–2.339 | 2.310–2.338 | 6.901 / 6.902 | 507 | 24 / 4 |
| 154 | 2.3 / 6.9 | 2.305–2.338 | 2.306–2.332 | 6.933 / 6.941 | 509 | 16 / 1 |
| 157 | 1.9 / 5.7 | 1.905–1.911 | 1.903–1.913 | 5.724 / 5.735 | 421 | 22 / 1 |

三房完整players同tick双端一致，9→0→9→8、6次正常Leave成功，服务/tmp清理；本次没有观察到相邻PLAYING服务tick间隔大于100ms。原值保留float32在JSON中。

旧`15-55-25-987Z`20房并发raw整体FAIL及104/154/157同rawdeadline/sync有限PASS保持不变，原240/273/1330ms停顿仍为真实旧证据。本次改变负载为顺序三房，不能据此证明旧并发负载已修复、全环境实时性能或所有拥有/装备/VIP修正覆盖。主线同步Leave burst修正与38连接断线性能证据独立引用，不混为本三房结果。M2-02原位只补当前条件的实时上界与normalLeave，父项不关闭。
