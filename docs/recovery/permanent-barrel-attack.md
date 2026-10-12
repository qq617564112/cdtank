# 永久炮管攻击消费者

M2-01 / M4-10 / M6-01。13001原ItemSkill0=13001，Skill.Trigger0、Target1、Func1、T65535、Atk20，原描述火力+20%；13011同入口提供AtkBonus20。普通Shop取得和Equipment装配复用正式事务，不新增拥有初值或期限规则。

原432951将Atk累加到role+74；4337d7按DataScale8限幅，421c4b在限幅后加入有效精通与owned+3c的贡献，433c55转换为float32比例。role+70为AtkBase、role+78为owned+40与AtkBonus之和。完整字段及计算顺序复用[tank-armor-qualification.md](tank-armor-qualification.md)，原来源不重新执行。attackPercent包含owned攻击贡献，不能当作单独的装备增量再乘车型攻击值。

正式attributes发布独立armorReady/recoveredArmor。消费者仅在armorReady且recoveredArmor存在时读取；撤回资格后残留字段不得生效。calculateQualifiedShotAttack计算Math.round(Math.max(0,attackBase*attackPercent+attackBonus))，结果直接进入现命中链。原配置/字段重算已确认；字段组合、取整、服务端伤害执行属于明确Web重建。资格不足的账户沿既有原型伤害入口。攻击饮料技能4已在currentSkillIds中触发重算，合格分支不再叠AttackBoostState。

tests/qualified-shot-attack.cts复用已有真实字段100/.731999933719635/78，结果151；Atk增20%后171。比例没有额外加1，非负截断与半数取整分别断言。纯规则actualexit0，见qualified-shot-attack.json。这不证明原服务器最终伤害公式。

tests/permanent-barrel-attack-network.cts准备3623普通双账户两房对照。复用10311真实检查点21-15-53-125Z：本人Tank3/Pet3、三槽中slot2实际部件7、资金83960；同库合法peer保原资料。无资金/Point/拥有记录补写。普通BUY13001后先未装配射击；第二房WAITING普通EQUIPslot0，再同车型、同宠物、同2001自然命中。预期依真实owned完整字段、原表、宠物六rank和当前技能重算原攻击字段，再以独立算式核damage及HP变化。只转炮塔和开火，不注入活跃位置、HP或伤害。

第二房先本人Ready，确认两端WAITING ready名单包含本人；EQUIP后确认两端ready取消且13001进入选技能，再双方Ready。两房保存完整source快照、模拟tick/.05秒、serverTime及接收wallTime，按room/round/phase/tick/serverTime比完整双端快照，普通Leave四次。关服后检查原生库存/完整profile/购买receipt，冷库存和outroom QUERY的battleQuantity均强断言0，再同数据库实际restart查询双账户完整Inventory/Equipment/OwnedRoles。finally保存数据库与0600私有身份并清服务。

## 正式普通网络验收

permanent-barrel-attack-network-2026-10-05T21-38-35-170Z.json通过，runner58181实际exit0。Tank3/Pet3和2001保持同源：attackBase100、attackBonus78，attackPercent .9759999513626099→1.1759999990463257，实际单hit176→196，恰好增加20。两房88/87共同完整快照逐值一致，普通Leave四次，Ready取消/source加入双端通过。原生完整barrel/profile/receipt与outroom QUERY相等，cold battleQuantity0/0；同数据库真正stop/start后的双账户全文QUERY相等。checkpoint180224B/private0600、finally清理和端口3623空已确认。

专属最终types-ready actualexit0；首类型推导失败日志保留，不属生产数值失败。分析索引permanent-barrel-attack-network-analysis.json。网络独立主审permanent-barrel-attack-network-root-review.json / PASS_FINITE_ORDINARY_BARREL13001_QUALIFIED_ATTACK176_196_READY_DUAL_STATE_NATIVE_RESTART_SCOPE已收。最终合审permanent-barrel-attack-root-review.json / PASS_FINITE_PURCHASED_BARREL13001_QUALIFIED_ATTACK176_196_READY_DUAL_STATE_NATIVE_RESTART_KEYBOARD_SUMMARY_CLOSE_SCOPE加入原生方向键/空格单hit196和新房普通结算退出/Close。首页面FAIL的已达射击范围与后继退出范围分别保留，原五模式两自然局为模拟50ms tick回归，不冒真实网页或真实网络时基。

## 未完成范围

原最终伤害、普通防御/侧背命中、暴击概率/倍率及全装备组合仍未恢复。当前仅准备永久13001消费者的首次普通行为验收；纯规则及类型通过不能代替玩家链交付。
