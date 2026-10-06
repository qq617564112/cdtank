# 战斗弹丸职责

E-02将正式World的弹丸步进收拢到battle/projectiles.ts。模块拥有BulletState类型，以及寿命递减、位移、地形/角色/破坏目标的最近扫掠碰撞、弹丸移除、地形命中事件组装。使用生产Battlefield与原场景破坏物OBB，没有第二套弹丸状态或几何算法。

World传入实际房间状态及同步命中回调。模块只要求角色ID/存活/位置，不依赖完整PlayerState或World类。玩家/目标伤害仍由World负责；目标伤害从模拟循环整理为damageObjective，保持生命、击中分、摧毁时间、摧毁计数与事件顺序。World保留普通输入/CPU入口、射击与装填、死亡/复活、玩法推进和一次性结算。

同步玩家命中可能结束对局并清空room.bullets；循环每次读取当前phase和弹丸数组，结束后停止遍历、不再移除已经清空的数组。最近碰撞的严格小于比较、寿命先于碰撞、原目标OBB与缺来源球体分支、地形事件坐标保持原行为。速度、枪口、生命期与伤害仍是既有原型政策，迁移不构成原弹丸参数恢复。

验收使用test:match和test:battlefield：五模式胜负/目标/冻结/再战、2058原碰撞盒与源出生点、权威运动及弹丸扫掠、命中破坏计分归属和恢复位置。build:server与test:server:compiled检查实际CommonJS服务联机、账户/迷彩重启保存和编译World的CPU五模式两局。类型与运行边界沿用全仓命令。World现1017行，房间生命周期、其余战斗步进和玩法策略继续逐片整理。

本片以上验收均通过，运行依赖边界覆盖177模块。证据为engineering-projectiles-{build,match,terrain,compiled,types,boundaries}.log。此次为服务端迁移，没有新增客户端渲染证据；原资源表现继续沿用对应客户端与渲染专题验收。

弹丸创建进一步收进同一战斗模块的fireProjectile：World在普通射击输入和装填期限确认后调用，提供本局相对时间和编号分配函数。战斗模块执行原自由瞄准、特殊标记清零、射击事件、枪口阻挡判定及实际弹丸创建；编号只在未阻挡时申请。原型速度360/枪口30与20/伤害/寿命2.2保持原行为。World现985行，projectiles为131行。

创建迁移后15组普通射击输入和实际World方向与原自由瞄准目标一致，地形/目标碰撞、五模式结算、编译真实账户与迷彩联机重启、CPU五模式两局、构建类型及177模块边界通过。日志为engineering-shot-{build,free-aim,terrain,match,compiled,types,boundaries}.log。
