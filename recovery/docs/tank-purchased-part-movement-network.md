# M2-03 / M6-06 正价引擎取得与运动消费

专属runner为`tests/tank-purchased-part-movement-network.cts`。初始四个真实Account无拥有记录；目标玩家仅资金profile夹具100000，TankShop tank3/PetShop pet2真实BUY与SelectRole后，Shop MONEY500真实购买16001。只验新取得部件的PART0装配、普通前移、双端同步、卸下恢复和持久槽/库存；原车宠交易、完整前后转向、生命和旧饮料证据复用。

## 来源与正式依赖

原`CDTank/Data/table/item.dat`的ItemType/ItemMoney/ItemCoin/ItemSkill1～3与`skill.dat`的TriggerType/FuncType/FuncT/属性由`recovery/export_combat_catalog.py`导出。以下均原正价定义，不代表原server出售权限已恢复。

| 类别 | 定义/名称 | 金钱/软星币 | 技能/非零属性 |
| --- | --- | --- | --- |
| 8 | 13001 生锈的强力炮管 | 500/50 | 13001 Atk20 |
| 9 | 14001 腐蚀的厚实装甲 | 500/50 | 13031 Def10 |
| 10 | 15001 锈蚀的射击装置 | 500/50 | 13081 Delay−2 |
| 11 | 16001 破旧的引擎 | 500/50 | 13061 ItemMove2 |
| 12 | 17031 黄金之光 | 1500/150 | 13501，无数值属性 |

五技能均TriggerType0、FuncType1/FuncT65535。16001的ItemMove2通过同一原合成限幅及精通公式贡献20坐标单位/秒，不逐件写最终速度。类别12仍存在有数值的其他定义，17031本定义仅装饰，不以它替代数值消费者。

已有效证据`account-battle-part-definitions.json`覆盖204分类/74部件定义及74原被动选择向量，属规则与World来源资格，未证明普通取得。原421cbe读取owned战车+6c，扣除+58/+5c/+60的非零固定部件后加六组有资格的rank技能；原42762e发3abb装备请求。正式profile+148五槽存拥有实例；`resolveBattlePartTableIds`仅将有归属、量>0、state2及8～12有效定义解析成role array2，43372d–43376b/432fe8经实际ItemSkill选择。归属/state/账户购买事务为服务端重建规则，selected pet不据此称为战斗boundGear。

## 本片验收范围

装配与卸下各一个短合法room。mode3第三玩家为非VIP；仅普通前移PlayerInput，不注入位置/HP/伤害/事件。按相邻tick距离除以固定0.05秒模拟时基测量，另存serverTime与接收wallTime。预期由recomputeQualifiedRoleMovement读取实际tank3/pet2/owned+34及真实16001源生成；该组合基础130、装配150，转速未改。本片不重复完整转向验收、不重启服务。

## 正式双端首验

`tank-purchased-part-movement-network-2026-10-04T17-19-20-732Z.json`为PASS；focused strict NodeNext类型PASS。新购实际owned+6c=2，16001购买实例3/金钱94000→93500，PART0槽3/state2/库存1。装备房0.4模拟秒前移60.004026单位，实测150.010065；卸下房0.4模拟秒前移52.004422，实测130.011056，均落在预设0.3单位/秒误差范围。两个房间各9共同tick全players双端一致。装备段server/wall为0.403/0.405秒，卸下段为0.403/0.401秒；不同于模拟时基，不宣精确实时性能。

正常双房Leave后，SQLite重新打开读取库存实例3/数量1/state0及profile五槽全0，Equipment QUERY同样五槽0；服务/tmp已清理。未重启服务、不注入活跃状态、不重复交易权限或旧车宠运动全链。索引tank-movement-player-accepted.json的purchasedEngineMovement限定此组合；全部车型/配装/M2父条件保持未完成。

## 缺失入口

原server购买建档producer尚缺：`tank-purchase-source.md`已有TankPartSlot2；对应owned+6c的原写入入口未恢复。初始购入策略写+6c=0，导致首正式装配EQUIPMENT_REJECTED“当前战车部件槽不足”。首raw为`tank-purchased-part-movement-network-2026-10-04T17-16-04-862Z.json`及同名server log，真实BUY成功，尚未开房，已清理。装配回复错误在server log完整保留。主线已对新BUY按TankPartSlot复制owned+6c，明确为重建初值；已有账户/receipt不迁移，本线不补拥有/槽夹具。中间缺partCapacity的购买回复失败raw17-18-36-875Z及同名server log保留，缺值修复后才启动最终对局。+34语义与原初值、独立role+a0技能绑定仍未恢复。
