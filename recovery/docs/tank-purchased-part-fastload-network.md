# M2-02 / M6-06 负LoadTime装备消费者

`tests/tank-purchased-part-fastload-network.cts`首次验证真实取得的15021填弹装置对普通弹末发装填的负修正。两个Account初始零拥有/库存，目标仅profile资金100000测试夹具→TankShop BUY3/SelectRole→Shop MONEY500 BUY15021→Equipment PART0。无pet、无拥有/库存/槽导入、无活跃位置/生命/伤害/事件注入。已通过正LoadTime15012、普通Delay15001及其他运动/生命/饮料证据复用。

## 原字段与单位

原item.dat：15021“填弹装置”，ItemType10、ItemMoney500、ItemCoin50、ItemSkill1=13101、图标13141。原描述为“装弹时间修正为45%”；原skill.dat唯一非零属性是LoadTime−45，TriggerType0、FuncType1/FuncT65535，符合43372d–43376b/432fe8的被动选择资格。原表由既有export_combat_catalog.py读取，不重新执行native。

实际归属实例state2/量1/profile+148→role array2定义15021→13101；432951按int32乘后f32累加LoadTime。普通2001/4020已确认LoadTime100，与−45合成为55，不根据描述直接填45%倍率。tank3原普通间隔1.5秒不变，容量7不变，末发通过普通未舍入乘积×55×原f32(.03)转换，精确输出由recomputeRoleAmmo生成。没有新的逐车或逐装备最终常量。

真实合法mode4/map7房普通held fire测首7发、0→补弹后首shot、公开reload.duration与双端相等。固定模拟tick0.05秒；服务器时间与接收墙钟分别记录。补弹与继续开火允许同tick，公开中间满匣并非要求。正常Leave后另打开SQLite确认部件仍量1/state2/装配槽保留，部件不会被普通弹消耗。

## 范围限制

原server购买建档/出售授权缺失；新购TankPartSlot→owned+6c与owned+34=0是现明确重建初值。独立宠物boundGear入口与原Windows正常行为测量未恢复。负LoadTime首验仅tank3/15021/普通2001组合，不推全部车型装备、不用原描述代计算结果，M2父项保持未完成。

## 正式双端首验

`tank-purchased-part-fastload-network-2026-10-04T17-38-09-248Z.json`整体PASS，focused strict NodeNext类型PASS。真实BUY15021实例2/金钱97000、PART0/state2/量1，无pet，selectedSkillIds2001/4020/13101。统一预期容量7、普通1.5秒、末发2.4749999046325684秒。

首7发tick2/32/62/92/122/152/182，剩6→5→4→3→2→1→0；tick232补弹与held输入同tick再开火，公开剩6，共本人8fire双端一致。末发公开reload.duration精确匹配统一原f32输出，末发至补弹模拟2.5秒/server2.512秒/wall2.512秒。模拟tick粒度0.05秒，不把量化后时间称精确墙钟性能。

232共同PLAYING tick全players双端相等，2次普通Leave成功；离房后SQLite另打开确认instance2/15021/量1/state2与槽[2,0,0,0,0]，服务/tmp清理完成。索引tank-ammo-player-accepted.json的purchasedNegativeLoadTimePart限定此组合，不改变既有原范围或关闭M2父项。
