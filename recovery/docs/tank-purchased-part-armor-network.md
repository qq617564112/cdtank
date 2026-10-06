# M2-01 / M6-06 正价装甲被动技能消费者

专属`tests/tank-purchased-part-armor-network.cts`通过正式BUY3/pet2/14001、Equipment PART0、真实饮料5库存与普通PlayerInput，核对装卸被动Def10对现公开defenseBoost输出的影响。两个Account初始零拥有/库存，只有目标profile资金100000测试夹具；不导入拥有、库存或活跃状态。旧饮料自然命中/VIP/生命/装填和车宠交易证据复用，不重跑那些范围。

## 原配置与消费者

`CDTank/Data/table/item.dat`记录14001“腐蚀的厚实装甲”：ItemType9、ItemMoney500、ItemCoin50、ItemSkill1=13031。原`skill.dat`技能13031为TriggerType0、FuncType1/FuncT65535，唯一非零数值Def10。两表由既有`recovery/export_combat_catalog.py`读取，来源定位与已有效74被动向量无需新native执行。

实际拥有实例state2/量>0/profile+148→resolveBattlePartTableIds→role array2定义14001，经原43372d–43376b/432fe8选择13031。Def在432951先int32 imul后f32累加，datascale10先上界再下界，421c7a精通加成在限幅后，433c55最终乘原f32(.01)。装备来源撤回时selector不再选13031；预期由实际tank3/pet2/owned五字段及skills/limits统一计算，不按装备名称写最终常量。

正式公开defenseBoost的source/baseDefense/boostedDefense是原属性消费者的实际输出。本片两短room分别装配与卸下，各普通useItem5一次，真实购买两份饮料有限消费2→1→0。模块和实际输出共用已确认属性链；percent+bonus合成及后续缓伤仍明确重建，不据此称原最终damage恢复。所选pet拥有不冒充战斗boundGear，owned+34=0及TankPartSlot→新购owned+6c仍为重建初值；原server producer、绑定入口与原客户端正常测量未取得。

只检查新部件来源改变与撤回、两端同tick公开字段、正常Leave与持久库存/槽。固定模拟tick0.05秒，服务器时间与接收墙钟分开保存；未等待自然命中或改生命/伤害，不扩模式/全部装备组合或+a0扫描。

## 正式双端首验

`tank-purchased-part-armor-network-2026-10-04T17-31-42-127Z.json`为PASS，focused strict NodeNext类型PASS。真实14001实例3/量1，PART0/state2；卸下后槽0/state0，两个短mode4/map7房各普通useItem5一次。

| 状态 | 原Def百分比 | 施放后百分比 | 公开baseDefense | 公开boostedDefense | 双端共同tick |
| --- | ---: | ---: | ---: | ---: | ---: |
| 装配14001 | 0.2019999772310257 | 0.5019999742507935 | 44.201999977231026 | 64.5019999742508 | 6 |
| 卸下14001 | 0.10199999809265137 | 0.4020000100135803 | 44.10199999809265 | 64.40200001001358 | 6 |

公开source均original-attributes，两端全players同tick一致；两房施放前后实际HP保持700，未因重算回血。4次正常Leave，SQLite另打开确认装甲量1/state0/profile五槽0与饮料库存0，Equipment QUERY五槽0；服务/tmp清理完成。

装配段输入至公开施放：simulation 0.05秒、server 0.05秒、wall 0.047秒。

卸下段输入至公开施放：simulation 0.05秒、server 0.051秒、wall 0.05秒。

索引tank-armor-player-accepted.json的purchasedPassiveArmor限定此真实14001组合，不把旧VIP drink证据改scope，不宣全部部件/配装或最终伤害。M2原攻防/生命/伤害父条件保持未勾。
