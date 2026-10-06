# 离房事务与房间补充

E-02将World.leave的正式离场事务迁入rooms/departure.ts，将默认模式与等待房间补充归rooms/availability.ts。World查找权威成员后调用模块，提供同步结算、正式开局、再战和房间创建入口；不建立第二份名单或结果。

离场仍先产生leave事件，由modes/outcomes检查弃权并同步调用settlement提交包括本次离场者的完整名单，再产生finish事件。随后删除玩家、准备/再战票和其弹丸。如果没有剩余真人，整个房间连同CPU回收，并检查五种模式默认房间；否则WAITING满足最低人数、双方队伍和全部确认时开局，其他情况尝试原再战入口。

两种补充政策保持区别：默认房间检查某模式任意阶段是否已有房间；开局与结算后的可用房间检查该模式是否有WAITING房间。创建仍使用rooms/create的源地图初始化与World的统一ID和注册表。重复/未知离场在World返回空事件，不重复补房。

## 验收

tests/room-creation.cts补充三真人普通创建/加入/准备：未准备者离场后剩余两人开局；实际时限终局后加入未投票者，另两人投票仍冻结，其离场后一致再战，局号和准备名单正确；最后离场清房，重复退出不增加房间，各模式仍有默认房间。流程使用正式入口，不注入房间阶段或名单。

既有26模式地图/密码/满员/回滚、跨房间冻结名单与CPU管理、五模式命中/终局/冻结/再战、真实TSRPC断线保留离场者结果/重新连接身份和再次准备、构建类型及198可达模块依赖边界通过。正常网页实际地图战车加载、准备取消、双向换队及退出清理通过。日志engineering-departure-{build,rooms,match,network,browser,types,boundaries}.log。

独立编译真实账户与迷彩联机重启保存、CPU五模式普通输入各两局及最后真人离开后CPU清房也通过，记录engineering-departure-compiled.log。模拟时钟两局与网页等待房间资源操作分开记录，不证明原全部玩法或高清性能。

## 后续边界

快速匹配已归rooms/quick-match，index账户绑定已归accounts/battle-binding，详见engineering-account-battle-binding.md；World账户到战斗准备、普通输入接受及index聊天断线/广播tick仍待分离。房间真实创建、加入、成员插入、CPU管理、离场和补充已有明确模块。E-02保持未勾选，以剩余职责的真实业务验收关闭，而非World行数。
