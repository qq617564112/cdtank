# 房间传输与运行循环

E-02将index的RoomState/RoomEvent/RoomSnapshot广播和聊天/断线注册归rooms/transport.ts，聊天身份及内容规则归rooms/chat.ts；固定tick调度归runtime/tick.ts。index现55行，只加载配置、组装账户/World/TSRPC依赖、注册API/消息并启动。模块直接使用正式连接与session映射，不另存接收名单。

每次广播按当前sessions筛选server.connections；RoomState从World当前快照投影玩家ID和名字，房间不存在时不发送。广播错误继续由对应原日志捕获。Chat从消息连接查参与者身份，由World查当前房间并调用roomChat，只允许频道0、非空且最多100字符、无控制字符；不信客户端名字或房间ID。

断线先删连接账户映射，读取并删房间session，再调用World.leave完成同步结算与清房，广播其事件，最后广播仍存在房间的RoomState。此顺序避免离场连接继续成为接收者，并保留其他玩家的完整结算名单与新身份重连行为。

startWorldTicks保留固定1000/tickRate模拟步长、原setInterval调度与启动时机，每步先广播全部快照，再广播事件；不使用新的墙钟补偿或异步战斗循环。返回计时器句柄供实际需要时释放，当前启动入口行为保持不变。

## 验收

真实TSRPC聊天身份/内容拒绝/跨房间隔离、战斗同步与旧包、断线结算保留离场者/重新连接新身份/一致再战通过；真实双连接治疗效果/账户隔离/持久消费及重启通过。正常网页实际地图战车加载、准备取消/双向换队/退出清理通过；构建类型与205正式可达模块运行边界通过。日志engineering-transport-{build,network,healing-network,browser,types,boundaries}.log。

真实本人AI托管双连接输入隔离/手动恢复/自然受伤治疗与效果同步/账户重启也通过，单列engineering-transport-autopilot-network.log；编译账户迷彩联机重启保存与CPU五模式各两局也通过，单列engineering-transport-compiled.log。不同验收的模拟时钟和实时联机范围分别保留，不证明全内容高清性能或完整原服务端规则。

## E-02完成边界

index的业务职责已归账户/房间/战斗/runtime；World仍有来源/属性/部件只读投影和破坏目标伤害写入。目标伤害计分已归modes、只读战斗投影归battle/projection、托管切换归battle/autopilot；最终职责审查和回归通过，E-02按工程范围完成，详见engineering-server-boundaries.md。行数不是门槛。
