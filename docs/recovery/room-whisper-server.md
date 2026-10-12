# 房间与战斗密语服务

`registerRoomWhisperApi(server,accounts,world,accountByConnection,sessions)`注册`RoomWhisper`。请求为`{text,targetName,roomId,round}`，响应为`{message:MsgRoomWhisper}`。消息包含进程内递增`id`、发送来源`roomId`/`round`、双方账户ID与确认昵称、修剪后的文本及统一密语显示文本。

发送者必须认证且仍是当前房间玩家，请求房间与局号必须匹配World快照。WAITING、PLAYING及FINISHED均可发送。目标昵称trim后精确匹配所有当前认证在线账户，按账户ID去重；目标可以在大厅、同房或异房，不要求其房间与发送来源一致。同名多账户拒绝，不猜目标；本人、离线目标及非法文本也拒绝。文本使用原请求72个UTF-16码元上限、控制字符及空白拒绝规则。

每次消息只向发送者及目标的全部当前认证连接发送，每个连接一份，不投递第三账户，不生成RoomEvent，也不改World聊天或大厅密语规则。成功确认返回同一权威消息。拒绝码为`ACCOUNT_REQUIRED`、`NOT_JOINED`、`ROUND_CONFLICT`及既有密语的`WHISPER_REJECTED`、`WHISPER_AMBIGUOUS`、`WHISPER_OFFLINE`、`WHISPER_SELF`。

协议用现有生成脚本生成，相关严格类型检查通过。`npx tsx tests/room-whisper-network.cts`通过：3205正式入口、六个真实连接和四个账户，正常Join/ChangeTeam/Ready、3秒自然TIME_LIMIT及共识再战覆盖三阶段密语、跨界面投递、旧局号拒绝、断线、同名，以及公共和队伍聊天各一次回归。结果与日志保存于`recovery/output/room-whisper-network.*`，专属服务与临时数据已清理。

## 来源边界

原对象昵称输入入口提供界面来源；此服务的跨在线账户路由、协议与发送资格是明确重建，不声明原服务器密语路由。消息的房间和局号描述发送来源，接收界面是否显示由其当前会话消费；真实网页验收独立覆盖。
