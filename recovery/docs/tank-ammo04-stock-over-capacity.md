# 有限库存大于计算容量时的末发消费者

M2-02新增边界由tests/tank-ammo04-stock-over-capacity-network.cts唯一首验。沿真实BUY3/pet2检查点，新Shop请求购入2004八发、Kitbag槽1，普通mode4/map7双账户Ready与连续fire；既有stock1/2/4不覆盖此库存大于实际计算容量的支路。

原共用计算来源2004/4020输出capacity7、normal1.100000023841858秒、last3.299999952316284秒。原423092只在发射前当前弹量恰为1时选last，其他值选normal；这个消费者合同复用已有效native。当前confirmAcceptedAmmoSelection以battleQuantity写bulletCount、consumeConfirmedAmmo逐次CAS扣数量是明示重建producer，没有恢复原服务端特殊弹匣的分段或补弹政策。

首次正式选弹投影remaining8/capacity7。八次成功射击后弹量7→6→5→4→3→2→1→0，ticks3/25/47/69/91/113/135/157；前七次duration均normal，只有最后一次duration为last。没有把计算容量7当成拥有量上限或提前在第七发执行末发装填。七个射击间隔各22步/1.1模拟秒，server/wall逐间隔保存在封装。

末发至ready为3.3模拟秒、3.309服务秒、3.292接收墙钟秒，ready是期限后首个合格服务tick。耗尽自动回普通2001保留末发duration，持续按火到ready后三tick没有赠射；释放后fresh普通输入7→6，普通duration1.5。Inventory回执2004 ownedQuantity0。

227次共同完整players观察和17个指定fire/ammoConsumed事件双同，两正常round1 Leave成功，3328无监听、临时库和进程清理完成。原raw tank-ammo04-stock-over-capacity-network-2026-10-05T04-46-39-268Z.json及同前缀-server.log，封装tank-ammo04-stock-over-capacity-player-evidence.json。

8/7仅描述当前有限库存到角色弹量的重建投影，不声称坦克原容量为8或已恢复原特殊弹匣。完整服务端数量producer、伤害、绘声、原库存分段与M2父项仍开放；无生产改动或旧native/types/build/重启复跑。
