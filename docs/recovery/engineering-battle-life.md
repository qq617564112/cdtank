# 伤害、死亡和复活职责

E-02将实际玩家命中处理与复活状态写入移入battle/life.ts。模块负责原有友军误伤分支、生命扣减、命中计分、死亡状态/计数、复活期限、击杀与摧毁分，并委托modes/outcomes处理队伍分/生命与当前模式达成条件。达成时返回赢家数据；World立即提交一次性结算并生成finish事件，随后弹丸循环读取FINISHED停止，保持决定性命中后的清空/冻结顺序。

复活继续从原地图出生点随机选择，重置位置/方向/瞄准、生命、存活/战斗状态、复活时间与输入，保留输入序号水位。生命上限策略由World提供，不推定尚未恢复的VIP复活规则。当前伤害与玩法条件仍是重建政策，不作为原伤害公式或原服务端胜负规则证据。

迁移验收全部通过：五模式命中/计分/终局/冻结/弃权/再战、原地图真实碰撞与恢复位置、自然治疗及CPU使用、编译账户/迷彩联机重启、CPU五模式各两局、构建/类型和185模块运行依赖边界。日志为engineering-life-{build,match,terrain,healing,compiled,types,boundaries}.log。

## E-02剩余边界

World可作为权威状态组装门面，但仍需分离实际职责：快速匹配；账户到战斗的库存/归属/装备准备；普通输入的身份/序号/快捷槽接受。index仍处理拥有战车解析和账户绑定、聊天/断线、广播和tick，应分别归账户、房间传输与runtime，启动入口只组装注册并启动。

开局事务已落实于battle/start与modes/start，首局/再战数量、序号、角色重置、联机保存和CPU五模式两局通过，详见engineering-battle-start.md。一次性结算冻结提交已归入settlement/finish-round，详见engineering-settlement.md。击杀与弃权玩法判定已迁入modes/outcomes，详见engineering-mode-outcomes.md。房间离场与可用房间补充已落实于rooms/departure和availability，详见engineering-room-departure.md。后续逐片拆快速匹配和账户准备配置，E-02保持未勾选；行数不作为完成标准。
