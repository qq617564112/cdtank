# M2-02 医疗弹完整300实际恢复

`medical-ammo-business-accepted.json`既有真实2009购买、43点限幅恢复、原绘声与实际重启证据复用。本片只补其明确未完成的“Uncapped300 actual healing”。

`tests/medical-ammo-full-heal-network.cts`两个正常Account初始拥有/库存为空，仅资金profile100000为显式夹具，其余bytes0。双方真实TankShop BUY3/PetShop BUY2→SelectRole，射手真实Shop BUY2009一发→Kitbag槽1；所有拥有/库存由正式事务产生，没有导入native拥有或注入活跃生命/位置/伤害/事件。

一个合法mode4/map7双人房，普通炮塔输入瞄准对手、普通2001持续射击产生7次实际命中，目标仍存活，生命由700至385。停火后普通useItem2选2009并开火，实际4007治疗300，目标385→685；没有将300写入生命，也没有改原型伤害以制造缺血。射手分数保持命中前值，医疗结果没有hurtSelector，双端playerHealed事件完全相同。

原HP300来自skill4007 Trigger8/Target5/FuncType2，item2009.info也明确300；主技能2009.info文字为100但其HP字段0，不作为命中治疗量。正式目标权限、跳过普通伤害及计分是现明确重建政策。治疗通过既有唯一setBattleHealth与原signed32生命限幅，完整伤害公式及原Target5消费者仍未恢复。本片不重新调查这些来源。

原始证据`medical-ammo-full-heal-network-2026-10-04T21-43-41-813Z.json/.log`为PASS_MEDICAL_FULL300_HEAL。实际新实例3库存1→0、ammoConsumed0/2009，364共同PLAYING tick全players一致，2次正常Leave成功、服务/tmp清理。模拟tick=.05秒、serverTime与接收wallTime分开保存。专属strict NodeNext `medical-ammo-full-heal-types-final.log` exit0。

范围仅为这次真实取得组合的完整300恢复、有限消费及同步/离房；不扩展为所有友敌/目标/异常、全车型/配装或原伤害/疗弹权限。旧购买拒绝、重启、绘声及300模块检查不重跑，主线按M2-02对应2009原位审查，父项保持未完成。
