# 客户端弹丸展示

正式客户端已移除黄色球体、共享发光材质与客户端球体外推。服务器BulletSnapshot、发射、轨迹、碰撞和伤害规则保持现有重建合同；普通2001通过角色03、原炮口004、GA07，以及原Shot分派允许的世界007/SE30展示。

此前E-03把球体网格生命周期从Battle迁入BattleProjectiles。该迁移的坐标、实例复用、释放与构建证据保留在`engineering-client-projectiles-{mesh,browser,cpu,build,final-types,boundaries}.log`，只证明旧占位实现的迁移正确，不证明原版飞行资产。球体模块及对应实现夹具已删除。

当前去占位验收与飞行来源缺口见`projectile-visual.md`。原独立飞行消费者仍未恢复，M2-04飞行展示保持未完成。
