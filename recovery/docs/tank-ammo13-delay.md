# 2013普通间隔与末发装填

M2-02首次实际消费者由tests/tank-ammo13-delay-network.cts验收。复用原真实BUY3/pet2的SQLite检查点，普通Shop新requestId购买2013两发、Kitbag槽1、mode4/map7双账户Ready，以正常连续PlayerInput开火。无活跃状态注入、装备/拥有补造或生产改动。

实际tank3拥有记录的+58/+5c/+60三来源均明确为0，当前技能按2013与4011提供原选择输入；宠物拥有记录不作boundGear。共用recomputeRoleAmmo输出容量7、普通1.5秒、末发4.5秒：2013 Delay17、MaxBullet6、LoadTime100经原坦克基础与限幅/f32合同计算。容量不代表购买数量，两发有限库存实际2→1→0。

| 消费者 | 模拟秒 | 服务秒 | 接收墙钟秒 |
| --- | ---: | ---: | ---: |
| 连续首发至第二发 | 1.5 | 1.503 | 1.500 |
| 第二发末发装填至ready | 4.5 | 4.517 | 4.510 |

两个deadline均满足首次eligible服务tick，前面不存在已越deadline却仍等待的快照。耗尽自动回普通2001保持末发duration4.5，不让原持续按下的开火输入赠送普通发；ready后三tick仍只有两次发射。松开后fresh输入普通开火，弹匣7→6、普通duration1.5。Inventory回执2013 ownedQuantity0；这不是原生SQLite持久或重启验收。

127次共同完整players观察全部一致，指定五个fire/ammoConsumed事件双同；两正常round1 Leave成功，3323已无监听，临时库与进程清理完成。原raw为tank-ammo13-delay-network-2026-10-05T04-24-00-910Z.json，完整服务日志同前缀-server.log，封装tank-ammo13-delay-player-evidence.json。

本片只补该组合有限弹药来源与期限消费者。4011 Trigger8/Target1/Func2/HP10没有恢复目标或数值执行，现projectile prototype不作为原伤害。原末发合同、控制映射与耗尽回槽政策沿既有来源/明示重建记录；其他车型/配装、原服务器Func2、图声与完整M2父项继续开放。
