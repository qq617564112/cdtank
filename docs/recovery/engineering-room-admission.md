# 房间创建与加入职责

E-02将正式房间初始状态迁入rooms/create.ts，将创建重试、密码与加入门槛、创建失败回滚迁入rooms/admission.ts。PlayerState归battle/player-state.ts，RoomState和JoinResult归rooms/state.ts；World继续导出JoinResult类型以保留原调用者合同。状态类型只存在于服务端，不进入shared协议，也不依赖World。

创建沿用原顺序：验证密码、确切模式地图与战车，清理房名并生成创建键，检查现有成员和完全一致的重试，再检查100房间上限。之后World分配房间ID并登记，admission写创建者/键、独立盐及scrypt哈希、房名，调用正式加入入口；加入抛错时删除新房间并继续抛出原错误。未修改失败分支前后的ID分配策略或扩大回滚范围。

普通加入先检查房间存在，再按连接身份返回既有成员；因此密码房重复加入、满员房重试以及开局后的重试均保持原身份。新成员才验证密码、容量和PLAYING门槛，通过后调用World原玩家插入入口。拒绝前不离开原房间；密码不进入列表/快照/玩家投影。

createWaitingRoom按源地图构建正式WAITING状态，包括原出生场景、空玩家/弹丸、局号/时间/准备和再战名单；World拥有注册表、ID分配及可用房间补充。普通玩家构造、移出原房间与CPU管理已迁移，详见engineering-room-membership.md；实际离房清理已迁入rooms/departure并验收，详见engineering-room-departure.md；快速匹配仍待后续迁移，不用把它们伪装成房间校验函数。

## 验收

tests/room-creation.cts增加实际填满声明容量后的拒绝/原房间身份保留、满员已有成员重试，以及正式createAndJoin分配房间后加入抛错的删除回滚/恢复重试。既有26源模式地图、密码错误与正确重试、房名、出生、准备/换队、清房均通过。tests/network-integration.cts以真实TSRPC连接验证密码创建与重试、错误密码后正常加入、PLAYING已有成员重试、房间隔离、战斗与再战。

账户来源与装备/部件冻结、五模式命中/冻结/再战、正式构建/全仓类型、193正式可达模块边界均通过。正常网页实际地图和战车加载、准备/取消、双向换队与返回清理通过。日志engineering-admission-{build,rooms,match,sources,network,browser,types,boundaries}.log。

编译真实账户/迷彩联机重启保存与CPU五模式普通输入各两局也通过，单列engineering-admission-compiled.log。网页此处是正常等待房间操作回归，CPU两局是编译World模拟时钟验收；两者不替代原玩法依据、全内容高清实战或全界面验收。
