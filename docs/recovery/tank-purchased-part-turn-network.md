# M2-03 / M6-06 永久ItemTurn装备消费者

`tests/tank-purchased-part-turn-network.cts`首次验证真实16011装卸对普通车体与独立炮塔合成转向参数的影响。四Account初始零拥有/库存，第三玩家仅资金profile100000测试夹具→真实TankShop BUY3/PetShop BUY2→SelectRole→Shop MONEY500 BUY16011→Equipment PART0。已有移速/装填/饮料和完整无装备转向证据复用，不导入拥有/槽或活跃位置/伤害/事件。

## 原来源与执行链

原item.dat：16011“迟钝的回旋驱动器”，ItemType11、ItemMoney500、ItemCoin50、ItemSkill1=13071、图标13071，描述回旋速度+8。原skill.dat：13071唯一非零属性ItemTurn2，TriggerType0、FuncType1/FuncT65535，符合原被动资格。原表与selector向量既有来源复用，不重执行native。

实际实例state2/量1/profile+148→role array2定义16011→43372d–43376b/432fe8选择13071→432951 ItemTurn int32累加→datascale15合成转向1～17限幅→原精通/type与f32单位转换。每个ItemTurn单位为4度/秒，因此此组合增加8度/秒；正式模块逐原参数计算，未写最终车型常量。

当前tank3/pet2/明确owned+34=0的统一原预期为无装备0.6806783676147461、装配0.8203047513961792弧度/秒。模块输出speed130两条件相同，本片只测静止旋转，不据此重复声明实际直线移速。A/D对应body turn、方向键对应independent aim，二者使用同一原转向参数仍为明确重建控制映射；没有原独立炮塔控制caller就不称其原独立公式。selected pet拥有不当boundGear，原+34购入初值、TankPartSlot→新购+6c及server出售/建档资格仍重建或未恢复。

## 正式双端首验

`tank-purchased-part-turn-network-2026-10-04T17-49-03-496Z.json`整体PASS。两个合法mode3/map7短房的第三玩家非VIP，分别装配及卸下16011；普通turn+1与aim+1各短段，位置全程不变，独立炮塔段body变化0。每段取8个相邻tick=.4模拟秒，角度与时间如下。

| 条件/输入 | 车体角差rad | 炮塔角差rad | 实测角速rad/s | server秒 | wall秒 | 共同tick |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 装配/body | 0.32810000000000006 | 0 | 0.8202500000000001 | 0.401 | 0.401 | 9 |
| 装配/turret | 0 | 0.32820000000000005 | 0.8205000000000001 | 0.401 | 0.401 | 9 |
| 卸下/body | 0.2723 | 0 | 0.68075 | 0.403 | 0.402 | 9 |
| 卸下/turret | 0 | 0.2722 | 0.6805 | 0.402 | 0.402 | 9 |

实测角速误差均小于预设0.002rad/s；快照角度按公开量化读数计算，不当原Windows客户端行为测量。四段每段9共同tick全players双端一致。8次普通Leave成功，SQLite另打开确认instance3/16011/量1/state0/profile五槽0，Equipment QUERY一致；服务/tmp清理完成。

focused strict NodeNext最终检查通过（tank-purchased-part-turn-types-final.log），首类型推断循环日志保留-types.log；只补回调类型，不改变输入或断言、不重复实际对局。索引tank-movement-player-accepted.json的purchasedPermanentTurn限定此组合，主线接线和tasklist原位勾选仍归主线；原完整21车型/装备组合、绑定与原控制来源保持未完成。
