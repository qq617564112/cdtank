# 房间命令、战斗输入与结算结构切片

E-02在账户处理之后继续整理实际对局业务。`rooms/api.ts`集中Join/CreateRoom/ListMaps/ListRooms/Ready/Rematch/ChangeTeam/Cpu/Autopilot/QuickMatch；保持既有TSRPC请求和错误码、加入后会话绑定、账户来源加载、确认与广播顺序。模块接收原来的World、连接会话Map，以及组装入口提供的roomTankId/bindAccountState/broadcastRoomState。它不复制账户存储或World房间规则。

`battle/input.ts`集中PlayerInput/PlayerAction接收；从连接会话读取playerId，调用World原输入/道具方法，将有序事件交给同一个广播函数。不增加第二条CPU或真人战斗路径。启动入口继续组装World/账户、会话映射、聊天、断线和tick广播；后续可根据实际职责继续拆分，不能把本片称为完成整个E-02。

`settlement/match-result.ts`收拢现有胜负、排行、同分名次、奖励和结算文字。World保留阶段门禁与一次性提交、终止时间、输入和弹丸冻结、结果保存及可用房间补充。原胜负和奖励政策没有因搬迁改变；原服务端规则仍缺证据，M2-11及各玩法验收保持未完成。详见engineering-settlement.md。

`rooms/snapshot.ts`负责玩家和房间的协议投影：坐标/角度/生命取整、账户拥有迷彩、CPU/托管标记、剩余时间、准备/再战名单、管理员、弹丸、比分、目标与结算结果。输入为局部结构类型，不依赖World类；World提供当前权威状态、时间限制、最低人数和生命上限策略。投影不步进或写入状态，弹丸/比分/生命/目标保持原有复制方式，已提交结果保持原有引用。World保留权威状态及广播时机，快照方法只负责调用投影。index现137行，World现1144行，生命周期、战斗步进和玩法目标继续逐片整理。

快照片验收通过：`npm run build:server`、`npm run test:match`、`npm run test:rooms`、`npm run test:accounts:sources`、`npm run test:server:compiled`、`npx tsc --noEmit`、`npm run test:architecture`。编译版真实账户及迷彩网络覆盖WAITING同步、PLAYING拒绝与重启保存，CPU五模式各两局通过；174个正式可达模块无取证/渲染验证依赖。日志为engineering-snapshot-build.log、engineering-snapshot-sources.log、engineering-snapshot-compiled.log；房间与结算命令的通过结果保留现有专题JSON。

`modes/objectives.ts`收拢占领/破坏目标创建及战斗后目标判定。创建使用实际场景破坏物、地图生命配置及现有导航可达性；占领更新所属队伍、争夺状态与队伍积分，返回目标是否达成；破坏模式返回目标是否全部摧毁。World仍负责弹丸命中后的生命/积分/事件，以及仅在PLAYING阶段执行目标更新和一次性终局提交。模块接收局部玩家/地图/战场结构，不导入World，不新增第二套状态。半径90、占领分数、破坏生命和胜负保持现有重建政策，原规则仍需独立恢复。

目标片迁移后World为1074行。独立服务构建、五模式结算/争夺/原场景目标碰撞/冻结/再战、26模式地图创建、编译真实账户与迷彩联机重启保存、CPU五模式各两局、全仓类型和175模块依赖检查通过。日志为engineering-objectives-build.log、engineering-objectives-match.log、engineering-objectives-rooms.log、engineering-objectives-compiled.log、engineering-objectives-types.log、engineering-objectives-boundaries.log。本片没有新增网页渲染验收；原场景目标模型和位置由现有服务端夹具核验，完整资源表现继续按M3/M4/M7逐项验收。

验收沿用现有房间26模式地图创建/幂等/出生/容量与密码联机、普通准备/取消/换队网页、五模式结算及冻结/再战测试，并运行编译版真实账户/迷彩联机重启与CPU五模式连续两局。证据在tasklist E-02原位登记，不追加progress流水。
