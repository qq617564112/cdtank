# 炮击侧面与背面装甲消费者

M2-01。原Tank.SideDef/BackDef经43b62a映射tank+a4/+a8，在4334e8初始化role+80/+84；432951累计已生效技能，DataScale12/13分别限幅0..100，433c55转float32比例。正式armorReady/recoveredArmor提供sideDefensePercent/backDefensePercent。

Web规则按真实来向相对target.bodyYaw分类：绝对包裹角≤π/4为FRONT、≥3π/4为BACK，其余SIDE。2001即时炮击来向为target→实际attacker位置；动态炮弹为实际velocity的负向，不用炮手后续位置替换。正面系数1，侧面与背面使用已资格字段；effectivePoints=max(0,DefPercent*100+DefBonus)*factor，damage=rawDamage*100/(100+effectivePoints)。damage保持浮点，既有HP setter逐击按value|0与max clamp发布整数。门槛、组合和服务器伤害授权是明确Web重建。

纯函数shot-defense-facet.ts及qualified-shot-defense.ts第三参数实现分面与修正。tests/shot-defense-facet.cts实际exit0，覆盖两侧45°/135°包含边界、yaw包裹、正侧背系数及非负防御点；证据recovery/output/shot-defense-facet.json。

3631普通网络稿tests/shot-defense-facet-network.cts复用已接受reactive-armor-network-2026-10-05T22-31-16-125Z检查点与双账户。正常UNEQUIP17071slot1保完整owned，0BUY/资金Point；同一房正常A/D转受击车体到三面中心、Arrow独立瞄准，peer三次2001自然命中。完整原字段重算验证本人Pet104/Def.17+44/Side.7/Back.5、peerraw151。每击保存bodyYaw/actualbearing/来源/独立damage与逐击整数HP，双端精确room/round/phase/tick/serverTime全快照和同hit，两Leave、原生完整profile/inventory/owned与既有receipt、同库restart四QUERY全等。首次actual99422退出1，三击与双状态/两Leave已到；原生资料与重启未达。有限结果见shot-defense-facet-network-analysis.json。

## 来源边界

21车型原配置轻型70/50、中型60/30、重型40/20、自走30/10；读取实际tank字段而非按族替换。10821“毫无破绽”文本支持装甲修正比例含义，Trigger2启动producer仍未资格。原435745 hurtSelector比较角色look驱动05..08动画，不作为伤害分面；既有动作映射独立保持。原server分面与倍率组合未恢复。完整source索引见shot-side-back-defense-consumer-preparation.json。

## 普通网络有限结果

首raw shot-defense-facet-network-2026-10-05T22-44-49-462Z.json保留FAIL。三面伤害93.78881977161026/105.8163984842481/115.70881218126303，逐击HP650→556→450→334；232个共同完整快照相等、两正常Leave。库存末态17071已正常卸下state0，驱动末态断言仍预期state2导致退出；仅静态修正预期。188416B检查点与0600身份已保存、3631端口已清。native与sameDBrestart尚未验证，未启动第二次运行。

必要冷尾分支SHOT_DEFENSE_FACET_TAIL=1复用上述first实际检查点与双身份，正常双认证后四QUERY全文严格等first.final；只读原生两profile/inventory/owned与保留receipt，再真实disconnect/stop/start同tempDB，双认证四QUERY全文等cold。无新房、射击或事务，必要syntax0；唯一尾段94217实际exit0。

必要冷尾raw shot-defense-facet-network-2026-10-05T22-48-09-119Z.json实际PASS_FINITE_DIRECTIONAL_ARMOR_FIRST_FINAL_COLD_NATIVE_SAME_DATABASE_RESTART_SCOPE。两账户完整四QUERY等first.final，原生完整两profile/inventory/owned与既有receipt相等，实际同tempDB停止再启动后两账户完整四QUERY等cold。0frames/0events/0新事务，188416B/0600检查点、清理与3631空已核。普通三面数值与Leave复用首有限范围，冷尾单独证明持久与真正重启。

网络有限主审recovery/output/shot-defense-facets-network-root-review.json：PASS_FINITE_NORMAL_BODY_TURN_THREE_FACET_DAMAGE_DUAL_STATE_NATIVE_COLD_RESTART_SCOPE。首99422原FAIL的三hit/232共同快照/两Leave，与94217onlycold实际0的完整持久和同库重启分列。World72416五模式各两自然模拟局为独立集成范围，不能代替真实三面几何或网页操作。combined页面主审见shot-defense-facets-root-review.json。

最终有限主审recovery/output/shot-defense-facets-root-review.json：PASS_FINITE_QUALIFIED_SIDE_BACK_ARMOR_NORMAL_BODY_TURN_THREE_HITS_DUAL_STATE_NATIVE_RESTART_KEYBOARD_SUMMARY_CLOSE_SCOPE。独立网页主审recovery/output/directional-armor-browser-root-review.json：PASS_FINITE_NATIVE_BODY_TURN_FRONT_SIDE_BACK_THREE_2001_HITS_DUAL_STATE_NATIVE_SUMMARY_HOME_CLOSE_SCOPE。普通原生A/D、三个2001命中、damage/整数HP650→556→450→334、双网页同连接tick完整players、0heal/item、summary退出与双HomeClose已有限收。网络主审独立保持shot-defense-facets-network-root-review.json；99422原FAIL与94217冷尾PASS分列。原server分面/伤害authority与完整全车型/全修正父项保持开放。
