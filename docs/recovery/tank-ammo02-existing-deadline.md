# 2002 float32装填与实际期限

M2-02复用已通过普通购买实战 `ammo-stock-purchase-network-2026-10-04T19-13-58-728Z.json`，专属 `tests/tank-ammo02-existing-deadline-analysis.cts` 对照实际tank3原配置、购买owned+58/+5c/+60字段与2002/4021正式技能来源。没有新增对局、库存、活跃状态或原native调查。

原同公式输出容量7、normalSeconds2.1000001430511475、lastBulletSeconds6.300000190734863。实际装填duration逐位相等；当前有限库存只2发，选择2/7→消费1/7→末发0/7，不把库存量2当弹匣容量。末发依据消费前恰1发，9秒2003旧范围不套2002。

首发tick3→第二45为2.1模拟秒/2.110服务秒，期限晚约9.9999ms；末发45→自动回普通171为6.3模拟秒/6.338服务秒，期限晚约37.9998ms。均没有更早满足服务deadline的采样tick；回普通沿原末发startedAt保留装填，随后fresh普通7→6。497共同完整players相等，4个2002 fire/consume核心事件双同。旧raw未记录接收墙钟时间，第三时基保持缺失。

购买、初始化、技能安装和有限消费是已登记重建policy；boundGear未确证，不替换成所选pet，AtkBase150不是完整伤害公式。本片不新增Leave/重启/声画范围，不据其勾完整装填或原producer父项。
