# 2003容量下限与装填实际消费者

M2-02复用已通过的普通真实BUY2003网络raw `ammo-stock-purchase-network-2026-10-04T19-13-58-728Z.json`，不新开房或复跑来源。专项 `tests/tank-ammo03-existing-deadline-analysis.cts` 输出 `tank-ammo03-existing-deadline-analysis.json`，仅复算该组合既有真实snapshot与事件。

源为正式BUY tank3/pet2、真实owned字段+58/+5c/+60全存在且0，2003/4022实际选择消费者。统一recomputeRoleAmmo沿原TankBullet1+MaxBullet1=2→限幅下限3，TankDelay-2+Delay32=30→3秒，LoadTime100→末发9秒。没有用宠物拥有记录作boundGear，没有把AtkBase200当最终伤害。当前技能安装/库存消费与购入初值政策仍重建。

原raw的特殊选择2/3→第1发1/3→第2发0/3。第1发tick3→第2发63，3.0模拟秒/3.016服务秒，准确服务deadline后16ms且无更早合格采样tick。末发tick63→自动回普通tick242，8.95模拟秒/9.004服务秒，准确期限后4ms且无更早合格采样tick；自动回普通保留原startedAt和9秒装填，随后fresh普通fire正常扣7→6。模拟tick50ms与服务期限独立，不能把8.95误称原9秒公式错误。

首局497共同tick完整players相等、4个2003 fire/consume核心事件双同。旧raw没有接收墙钟时间，不补造第三时基；自然终局/再战/Leave/重启是已有ammo-stock-business独立scope，本片不新增此宣称。全部装备修正、原server producer、Windows行为测量与完整父项继续未完成。
