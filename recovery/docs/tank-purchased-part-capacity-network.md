# M2-02 / M6-06 扩充弹仓容量限幅与特殊装填

`tests/tank-purchased-part-capacity-network.cts`只首验实际装备来源MaxBullet及LoadTime的统一弹药消费者。初始两个真实Account零拥有/库存，目标资金profile-only100000→TankShop BUY3/SelectRole→Shop MONEY1000 BUY15012→Equipment PART0。无pet拥有或绑定、不导入槽或活跃状态；原购买server初值/授权仍重建。已通过15001的普通Delay及其卸下、14001Def和16001运动证据复用，不复跑旧部件链。

## 来源、公式与依赖

原item.dat：15012“巨大的扩充弹仓”，ItemType10、ItemMoney1000、ItemCoin100、ItemSkill1=13092。原skill.dat：13092 TriggerType0、FuncType1/FuncT65535，非零MaxBullet6/LoadTime50；原目录与技能向量由既有export_combat_catalog.py/74被动向量确认，无新native执行。

实际归属实例state2/量1/profile+148→role array2定义15012→43372d–43376b/432fe8选择13092。432951按int32累加MaxBullet、按int32乘后f32累加LoadTime；limits17容量3～9。普通2001/4020提供已确认LoadTime100，实际合成为150，而非逐车硬填末发常量。tank3 TankBullet7加6得13，原限幅至9；普通TankDelay15不变、原转换得1.5秒，末发沿普通未舍入乘积×合成150×f32(.03)转换。精确预期取同一recomputeRoleAmmo输出，原owned+34不依赖宠物来源来取得弹药资格。

本片一合法mode4/map7房普通持续fire，测首9发有限消费、0→补弹与持续输入后的首次消费，公开reload.duration及双端相等。模拟tick0.05秒，serverTime与wallTime分开采样；容量和LoadTime是新装配引入的实际变化。持续输入允许同tick补弹再消费，不强求公开中间满匣快照。普通离房后另打开SQLite核实际装配槽/state2/数量1，不把部件当消耗品。

## 未恢复范围

新购买TankPartSlot→owned+6c、完整未强化建档及开放售卖资格为明确服务端重建，原producer未取得。原+34初值/独立宠物boundGear、全部车型取得与配装资格仍有缺口；原Windows正常行为测量未取得。只证明tank3/15012/普通2001这一组合，不以目录74项或模块向量冒全部装备联机。原攻击/最终damage消费者不在本片，M2父项保持未完成。

## 正式双端首验

`tank-purchased-part-capacity-network-2026-10-04T17-35-28-163Z.json`整体PASS，focused strict NodeNext类型PASS。真实15012实例2/量1/state2/PART0，余额100000→97500购车→96500购部件。无pet，selectedSkillIds2001/4020/13092。统一预期容量9、普通1.5秒、末发6.75秒，出生发布9/9。

实际首9发tick2/32/62/92/122/152/182/212/242，剩8→7→6→5→4→3→2→1→0，普通reload.duration1.5，末发6.75。tick377补弹与held输入开火同tick，公开0→8，共本人10fire双端一致；中间满9不要求单独发布。末发135tick=6.75模拟秒，server6.787秒、wall6.785秒；八个普通间隔各30tick=1.5模拟秒，其server/wall原采样保留raw，不宣精确墙钟性能。

377共同PLAYING tick全players双端相等，2次正常Leave实际成功；离房后另打开SQLite读取实际instance2/15012/量1/state2及五槽[2,0,0,0,0]。部件不被普通弹消费，服务/tmp已清理。索引tank-ammo-player-accepted.json的purchasedCapacityLoadTimePart限定此组合，未重跑旧native/车型/饮料/运动/切弹，M2父项保持未完成。
