# Pet104生命吸收消费者准备

M2-01 / M4-10 / M6-04。Pet104 Skill0=10911、cap3，原owned rank字段+5c；下一等级ID=base+rank，rank0学习10911花费40原Point，后两等级70/100。技能10911..10913的HPDrain10/20/30、Trigger0/Target1/Func1/T65535，原文“生命吸收+10%”等，符合已有被动来源筛选。

原4334e8初始化role float+94=0；432951按int32乘倍率后加float32，DataScale4限幅，433c55乘float32(.01)。RoleAttributeState正式发布combat.roleFloatFields+94，缺资格时不能读取残留；候选consumer按attributesReady门禁。当前World/life在命中后只扣target HP，未读取生命吸收字段，真实学习后该被动无恢复效果。

HPDrain此处是生命吸收比例，不能借同名概念套入ammo-burn的周期70HP。后者有独立时间合同且不读role+94。最小完整Web提议仅在本人存活且敌对炮击实际移除target HP后，按该实际移除量与已资格比例恢复attacker；过量伤害不超过target原HP、immune/reject不恢复，现maxHP限制及整数HP setter共用。正式Web政策为calculateShotLifeDrain(actualHpRemoved, qualifiedRate)：资格undefined恢复0，其余Math.round(Math.max(0,loss*rate))。loss使用扣血后hpBefore-target.hp的整数差，不能用浮点hit.value。敌对非自身普通ammo炮击成功后、attacker存活且attributesReady合格才读+94；friendly、immune、medical及periodic均剔除。恢复仍经现maxHP clamp，playerHealed.value只发布实际恢复，无虚构skill/FX。原server时序、量基准及舍入仍未恢复。

普通验收可复用normalarmor合法双账户存档，不改资金或拥有记录，预服务仅Point40明确非earned，正常BUY104/SelectRole/LEARNslot0。对手自然炮击造成缺血并停止，随后本人2001正常命中，核target实际整数HP移除与attacker恢复、双同key完整状态/同hit、Leave、原生六rank/profile/receipt及同库重启。无活跃位置、HP、时间或事件注入，不复旧food/饮料/Trigger矩阵。具体合同pet-life-drain-consumer-preparation.json；normalarmor合审已完成，新3627窗口等待正式consumer编译释放。普通BUY前卸下slot2，避免借旧Pet3额外槽权限；不引入换宠物自动清槽规则。

完整来源链：pet-shop.ts重建完整owned base字段及六baseID/rank0；pet-skill-learning.ts原子写slot0 +5c=1、扣profile raw+80 Point40并保存receipt；新学习成功在WAITING经pet-skill-learning-api.ts重绑。selected-bound-source.ts独立复制六base/rank，RoleAttributeState完整重算后发布+94，consumer另核attributesReady。购入初始字段与绑定authority是明确Web重建，不冒原battle+a0 producer。

shot-life-drain-amount.cts实际exit0，shot-life-drain-amount.json核资格undefined、0/负比例、原float32比率、94/95损失舍入边界和7实际损失。这里只证明明确Web恢复量政策，不替代命中consumer或网络。

独立driver tests/shot-life-drain-network.cts / 3627已准备，来源normalarmor-21-56实际双账户库，预服务只设Point40；首次普通BUY104后保存完整购买记录，WAITING学习成功重绑并取消Ready。完整原重算completed=true、+94与独立HPDrain/DataScale4/f32累加结果一致、maxHP与公开快照同；attributesReady没有公开wire字段，正恢复由正式consumer门禁证明。普通peer单hit造成缺血，host单hit按整数HP差验恢复与playerHealed实际值，普通双Leave后核冷完整QUERY、完整原生双profile/owned/inventory和购买/学习receipts、同路径服务重启双全文相等。专属类型检查exit0。实际网络的已证明与未达范围见下。

## 有限实际来源证据

首raw shot-life-drain-network-2026-10-05T22-13-08-632Z.json / runner88331 exit1，独立firstRootReview pet-life-drain-network-first-root-review.json接受普通BUY104实例9、LEARN10911 cost40/rank1/Point0、WAITING取消Ready与双端来源、原生profile/选择/六rank/receipt。射击前仪器误把mode4 team0当同队，原FAIL保留。

必要tail raw shot-life-drain-network-2026-10-05T22-14-57-010Z.json / runner36895 exit1，复用首实际库且无新购买/学习/Point修改；双方完整原重算completed=true，本人role+94=.09999999403953552、peer=0。current16合法包含Trigger8的4020，HPDrain为0；来源oracle误将全selected要求Trigger0，原FAIL保留。静态修正只对10911核被动合同，current槽按原Trigger14-only倍率参与重算。两份实际均0shot，不能称普通命中吸血、Leave或重启已验；各188416B检查点/private0600/3627清空。分析shot-life-drain-network-analysis.json限定证据范围，后续服务窗口另协调。

页面3628承接未达自然炮击/吸收、Leave及重启范围，数值第三runtime停止。尾段实际完整来源供独立oracle：peer raw151→本人damage93.78881977161026、HP650→556；本人raw220→peer damage142.6718549105869、HP700→557，整数loss143对应恢复14、本人→570。这些是已保存真实source下的预期值，不是两份0shot raw的实战结果。

## 最终有限合审

mainReview为pet-life-drain-root-review.json / PASS_FINITE_PURCHASED_LEARNED_PET104_10911_HOSTILE_SHOT_LIFE_DRAIN14_DUAL_STATE_NATIVE_RESTART_KEYBOARD_SUMMARY_CLOSE_SCOPE；独立browserRootReview为pet-life-drain-browser-root-review.json / PASS_FINITE_LEARNED_PET104_10911_NATIVE_HOSTILE_SHOT_HEAL14_DUAL_STATE_NATIVE_RESTART_SUMMARY_HOME_CLOSE_SCOPE。实际tick259双方确认HP650→556→570/peer557、dual playerHealed14；双冷四QUERY同库重启、完整原生profile/owned/inventory及两receipt已主审。numeric88331/36895两份FAIL/0shot保持，不改成网络shotPASS。原server吸收公式/Point取得及完整宠物父范围继续开放。
