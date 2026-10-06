# 永久装甲的正常炮击消费者

M2-01/M4-10/M6-01。普通装备14003的13033被动经过原来源选择、限幅、精通与float32转换，进入已资格的defensePercent与defenseBonus。前者已经是比例，后者仍是整数加值。

正式Web炮击政策将defensePercent乘100转为防御点，加上defenseBonus后限为非负；伤害为rawDamage*100/(100+defensePoints)。命中事件保留浮点伤害，生命沿现setRoleHp整数赋值及限幅发布。原字段及重算有来源，防御点合成与伤害比例为Web重建。

只有带ammoItemId的炮击且armorReady/recoveredArmor完整时消费当前防御字段。活跃防御饮料已经进入current技能重算，资格分支不再次应用defenseBoost增量。资格撤回或值缺失沿既有饮料处理。周期4005没有ammoItemId，保持现周期处理；医疗弹在World入口先独立分派。友伤与无敌门禁先于减伤。

Root owns battle/life.ts、world.ts的资格与权威执行、consumer及工程；Numeric owns qualified-shot-defense.ts、来源与普通网络对照；UI owns正式装备和原生命中/退出driver。玩家使用已普通取得的14003实例，卸slot2后正常peer2001命中，再等待房装回取消Ready、重新Ready后同炮击；双端完整快照、四Leave、原生保存与双方冷QUERY同库重启为实际验收终点。

## 工程范围

permanent-armor-engineering.json登记纯规则、生命consumer、类型与服务端构建。消费者覆盖当前药水单次减伤、周期伤害边界、资格撤回/值缺失、友伤与无敌，以及命中事件和角色整数生命的一致发布。正常药水World两自然局覆盖本人自主使用2次、CPU3次、35次减伤命中、23次自然死亡与20次复活、库存耗尽和存储重开。

qualified-shot-defense-modes.json覆盖五模式各两自然模拟局、164次本人攻击与171次装甲受击、自然结算再战及退出；50ms模拟tick不代替实际网络或网页。生产已构建并复制发行，普通卸装/装回网络对照已亲审permanent-armor-network-root-review.json：raw151→95.812183/87.485516，生命650→554/562；两房各14完整共同快照、Ready重置/13033、四Leave、原生188416B完整保存和双冷QUERY同库重启全文相等。

正式网页equipped-normal-armor-browser-root-review.json有限收录原Home持有确认、peer原生Space96ms/一个true输入/一次2001开火、双hit87.485516与HP562、同tick33完整快照及双方页面players匹配各自快照。普通peer PLAYING Leave→host FINISHED summary Leave→双HomeClose通过，原生资料和库存保持。合审permanent-armor-root-review.json。

## 未完成范围

原最终防御公式、侧背、暴击、全配装/弹药与高清父项仍开放。
