# 账户到房间战斗的绑定

E-02将index中的拥有战车解析、房间选车、账户库存/拥有来源/装备profile绑定和持久道具消费归accounts/battle-binding.ts。启动入口创建账户与World、传入实际连接账户映射并组装函数，再注册原API；不建立第二份账户或参与者状态。

ownedTank沿用拥有equipment记录+24至源TankTable的解析，缺少归属或定义仍拒绝。roomTankId在连接有账户profile时读取原0xa8选定实例并使用拥有战车定义，不相信请求中的战车ID；无账户/profile保持原请求回退。房间API先加入并记录session，再依次绑定库存、拥有来源、装备profile，全部沿用World的现有准备/冻结入口和顺序。

consumeAccountBattleItem按当前playerId查实际session的连接身份，再查连接账户并执行原账户消费；没有会话或认证映射时拒绝。只确认成功后World治疗模块更新战斗库存、生命和效果，避免将CPU或其他连接的库存映射为本人账户。CPU管理与真人托管仍使用各自现有身份。

快速匹配的公共WAITING/容量选择移入rooms/quick-match.ts。沿用注册表首个满足条件的房间；无房时World按原nextRoomId推导模式地图并创建，再调用同一个joinRoom入口。此次不推定新的原服务端匹配算法或改动原回退策略。

## 验收

正式构建、全仓类型、200正式可达模块运行边界、26房间模式地图/密码/容量/回滚、真实TSRPC隔离/身份/准备/战斗/断线/再战、账户来源/装备/部件冻结和治疗真实双连接消费/账户隔离/服务端重启通过。日志engineering-account-binding-{build,rooms,sources,network,healing-network,types,boundaries}.log。

编译服务端账户网络夹具验证CreateRoom/Join/QuickMatch拒绝无效拥有来源，QuickMatch/CreateRoom/Join均以选定拥有战车覆盖请求ID，库存装备变化与冻结、账户/迷彩联机重启保存；同一编译World验收CPU五模式普通输入各连续两局。上述编译验收通过，证据engineering-account-binding-compiled.log。正常网页账户装备操作、资源预览/1080p与4K布局/关闭清理与重启保存也通过，单列engineering-account-binding-browser.log。

## 后续

index仍需整理聊天/断线与房间广播/tick；World账户到战斗准备已归battle/preparation并验收，详见engineering-battle-preparation.md；普通输入接受仍待分离。此片完成index的账户业务责任迁移，不表示整个E-02或原完整装备玩法完成。
