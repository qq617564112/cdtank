# 3005活跃禁射死亡与复活

FUNC05/FUNC12/M2-05首次生命周期actual，runner `tests/trap-fire-death-network.cts`，证据 `trap-fire-death-player-evidence.json`，raw `trap-fire-death-network-2026-10-05T04-04-54-618Z.json`。角色与余1软木塞来自已真实BUY3/pet2/3005的原生SQLite副本。全程普通射击、放置、移动；无活跃HP/位置/flags/事件写入，未改变期限、伤害或复活policy。

普通2001预伤使目标活着25HP，tick676正式敌方接触4003/count0，tick677普通命中自然HP0死亡，死亡比原expiry早4950ms，因此覆盖活跃束缚而非自然到期。该死亡快照已移除trapFireRestraint。tick737自然复活HP/maxHp700、无旧束缚、弹匣7/7；tick738目标普通fire实际消费6/7，证明真实开火许可重新可用，不冒称无state时投影了原flag11准确计数。

死亡到复活60tick/3.0模拟秒、3.009服务秒、3.004接收墙钟秒；旧expiry之后仍无束缚、没有trapRestraintEnded事件，未额外恢复已丢弃贡献。778共同完整players一致，指定trigger/destroy/respawn三事件双同，双round1 Leave成功，3321服务与临时目录清理。

原4259ae状态3清9–11/状态2生命周期与已通过原规则证据复用；ground restraint贡献丢弃、真实服务端复活授权/3秒时长及damage仍明确重建，25HP只是自然预伤结果。此片不新增原伤害精度、库存持久重启、声画、再战或全部异常生命周期claim。
