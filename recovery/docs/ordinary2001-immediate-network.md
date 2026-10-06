# 普通2001即时权威命中网络验收

M2-04-VISUAL正式普通2001射击在接受发射时查询目标，PLAYER立即进入生命权威并通知命中，SCENE沿原endpoint／terrain分支，默认弹不创建延迟bullet。真实双连接普通对局收到fire与对应hit的有序通知和一致生命，正常死亡、复活及离房通过。

`tests/ordinary2001-immediate-network.cts`使用独立正式index3249、临时SQLite、两个认证账户和一个正常CPU。开局账户夹具仅为完整已有pet1／tank1、基础HP200、默认2001、空道具库存；所有战斗位置、朝向、生命、伤害及事件来自正常World。owner普通PlayerInput首发后停火，两真人随后通过正常Autopilot请求托管自然交战。没有第二局、账户重启、资源或高清验收。

首次有效PASS为`recovery/output/ordinary2001-immediate-network-2026-10-04T14-08-56-625Z.json`及`.log`。

## 即时通知与生命

| 验收项 | 实测 |
| --- | --- |
| 普通合法入场 | mode4／map7、两真人加CPU、Ready进入PLAYING |
| 初始生命 | 两真人200／200，CPU默认300／300 |
| PLAYER普通fire | CPU P3→真人P2，skillId2001，没有shotDisplay |
| 对应即时hit | 同P3／P2，伤43、hurtSelector2、shotPlayerResult.itemId2001 |
| 双端时序 | 两端均fire在hit之前；均最近已接收snapshot tick5，同receivedAt1791122938809 |
| 双端消息一致 | 共同34个fire／hit／scene／destroy／respawn相关通知严格同序同值 |
| 共享生命 | tick6双方完整players一致，P2 HP157／maxHp200 |
| 默认bullet | 双方各126个保存snapshot，bullets始终0 |
| SCENE显示 | owner普通首发，观测tick2目标9，shotDisplay.itemId2001，无shotPlayerResult |
| 正常生命循环 | P1自然击毁P2，随后P2正常respawn通知 |
| 正常离房 | 两连接Leave成功 |

网络RoomEvent没有独立tick字段。tick5为通知接收时该连接最近已接收的snapshot tick；它与同一次fire／hit通知及随后tick6的HP更新构成实际立即处理证据，不将该观察值伪称原事件内携带tick。PLAYER处理的同step关系沿正式fireProjectile2001→hitPlayer→applyPlayerDamage同步调用路径。

每条已观测SCENE／FREE型fire具有原即时显示payload且自身没有player结果；同攻击者／目标／观察tick不存在关联的假PLAYER命中。此次实际显示样本为SCENE9，未将它扩大为真实FREE分支覆盖；FREE的直接规则由正式实现／独立规则证据承担。

## 已知边界

射击目标query几何、服务端伤害及生命权威为明确重建规则；普通客户端PLAYER／SCENE／FREE立即分派来源与现有原通知消费者保持各自范围。本片只验默认2001，不将2007等特殊弹的延迟运动规则改为即时。网页声画、原FX实际绘制由独立scope承担，不由本网络记录代替。

## 清理

所有专属index与连接停止，临时SQLite目录删除。3249无监听进程，`/tmp/cdtank-ordinary2001-immediate-*`无残留。首次必要验收PASS后停止运行。
