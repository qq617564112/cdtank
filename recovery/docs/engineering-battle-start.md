# 首局与再战的开局职责

E-02将正式World.startRoom的角色初始化迁入battle/start.ts，将队伍分、队伍生命及VIP选择迁入modes/start.ts。首局准备和一致再战继续走同一个真实开局入口，没有增加替代状态或新的调度框架。

World依次提交PLAYING、开始/结束时钟和tick，初始化模式，清理赢家、结果、弹丸与再战票，再初始化角色、创建目标和补充等待房间。battle模块按房间玩家插入顺序读取原出生点，初始化战斗状态与七个已分配道具的可用数量；随后由模式回调选定VIP，再重算完整拥有来源属性、写入生命、清分数/击杀/死亡/破坏数和复活时间，重建CPU与托管控制器并清普通输入。占领目标仍在实际出生坐标更新之后创建。

modes保留现有重建策略：队伍分归零；团队模式生命使用地图正tankLimit，否则30；擒王模式按参与者顺序每队首人为VIP。VIP原属性来源与原服务端玩法仍未恢复，此次迁移不提供原规则证据。VIP生命上限和普通角色生命上限由World的既有策略提供。

人的inputSequence水位保留，旧局输入不会因再战重新生效。CPU的普通输入序号清零，托管输入序号单独清零；账户库存仍由权威玩家持有，每局仅重新初始化七槽对应记录的battleQuantity，未分配记录不改、ownedQuantity不重置。

## 验收范围

- tests/item-request-world.cts增加实际时间到期、普通再战后的整份库存对照，验证数量上限、未分配记录与账户拥有数量，并拒绝旧局输入。
- tests/match-rules.cts增加首局和再战地图队伍生命断言；既有五模式结果、清弹丸、冻结、角色状态重置、VIP生命和旧输入拒绝继续通过。
- 账户来源与装备/部件冻结、自然受伤治疗及剩余库存再战、CPU九次普通治疗和自然两局通过。
- 独立编译服务端从外部工作目录运行，真实账户与迷彩双连接重启保存、五模式CPU普通输入各两局通过。
- 正式服务端构建、全仓类型和187个正式可达模块依赖边界通过。

日志为recovery/output/engineering-start-{build,counts,match,sources,healing,compiled,types,boundaries}.log。浏览器资源失败重试/加载/准备/渲染运动/退出回归也通过，单列engineering-start-browser.log；这些验收证明结构迁移保持既有行为，不证明完整原规则或全内容高清表现。

## 后续边界

E-02仍未完成：房间生命周期、账户到战斗准备配置、普通输入接受，以及index中的拥有战车解析/绑定、聊天断线和广播tick。结算提交已迁入settlement/finish-round，决定性命中同步冻结后弹丸循环停止的约束保持通过，详见engineering-settlement.md。玩法终局判定已迁入modes/outcomes，详见engineering-mode-outcomes.md；后续继续拆房间生命周期。
