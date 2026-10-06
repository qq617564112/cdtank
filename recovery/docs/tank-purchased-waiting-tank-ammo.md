# 等待阶段换坦克的普通弹药来源

M2-02首次覆盖正常购入坦克在WAITING替换当前坦克后，普通2001首弹匣及连续间隔使用新定义来源。tests/tank-purchased-waiting-tank-ammo-network.cts复用真实BUY3/pet2原生检查点，新TankShop BUY154后RoleProfile仍选择原tank3；普通mode4/map7双账户入房并保存WAITING实际tank3观察，再以SelectRole明确选择新拥有实例，正常Ready进入tank154/pet2非VIP对局。

实际旧/新拥有字段分别进入同一recomputeRoleAmmo，原技能选择均为2001/4020；旧tank3 capacity7/normal1.5与新tank154 capacity9/normal2.2999999523由源公式得出，不以车型固定常量替代。实际首弹匣9/9，正常heldfire两次消耗9→8→7，随即停止射击。tick2→48相差46步，2.3模拟秒、2.314服务器秒、2.310快照接收墙钟秒；第二发为首eligible tick，晚于deadline14ms。

48次共同PLAYING观察完整players相等，指定两fire事件双同，两个round1 Leave正常成功。原始记录tank-purchased-waiting-tank-ammo-network-2026-10-05T05-23-26-045Z.json及同前缀-server.log，摘要tank-purchased-waiting-tank-ammo-player-evidence.json；3335无监听、服务/临时库清理完成。主审另在摘要mainReview登记。

本片仅source替换到2001首弹匣/普通连续间隔。原账户WAITING换车和取消准备合同复用；tank154既有末发6.9/补弹/三车实时与Leave证据继续沿原范围，不另跑完整车型套件。新购入初值、服务器选用/技能安装/弹匣初始化仍为既有明示重建；原boundGear与最终伤害没有恢复，本片无新FX、库存重启或活跃对局换车证明。原Windows客户端行为测量仍不足，墙钟数字仅为此次正常快照观察。
