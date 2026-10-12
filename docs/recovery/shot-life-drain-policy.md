# 学习技能后的炮击生命吸收

M2-01/M4-10/M6-04。Pet104普通学习10911的原HPDrain10通过被动资格、role+94累加、DataScale4及float32百分比转换成为已资格生命吸收比例。正式消费者只在attributesReady时读取combat.roleFloatFields+94，资格撤回忽略旧值。

Web政策仅对敌对、非自身、带ammoItemId的合法炮击，在目标现有整数生命实际减少之后，按Math.round(max(0,actualHpRemoved*qualifiedRate))恢复存活攻击者。超杀只按目标实际失去的生命计量，不按浮点命中值或原始攻击计量。恢复经过现setBattleHealth最大生命限幅，通知value为实际恢复值；满生命、无资格、比例零或取整恢复零不新增通知。

友伤与无敌门禁、医疗弹先行分派及周期燃烧不进入生命吸收。现playerHealed事件与完整生命快照发布实际恢复，不新增协议或原特效身份。

原字段与被动学习资格有来源；恢复量基准、取整、服务端时序与敌对权限为Web重建。Root owns life.ts、shot-life-drain.ts、consumer与World工程，Numeric owns shot-life-drain-amount.ts及专属普通购买学习网络；UI owns已学Pet104确认、原生双向炮击和正常退出验证。

## 实际验收

普通BUY104及LEARN10911 rank1/cost40、Ready取消与native receipt经主审确认；Point40为明确开服前夹具。网页17086真实双向原生2001炮击：本人650→556，命中对手700→557实际移除143HP，恢复14后本人570。tick259双端完整快照、网页生命、两Leave/HomeClose及双账户冷四QUERY同库真实重启一致，原生数据库完整profile/owned/inventory和购买学习receipt一致。主审见recovery/output/pet-life-drain-root-review.json。

World五模式各两局自然模拟累计158本人命中、130次吸收和1957HP恢复；2次独立食物消费由事件账核。四模式资格生效，VIP模式3资格撤回。工程见pet-life-drain-engineering.json。

## 未完成范围

原最终吸血公式和Point取得、完整宠物技能与高清父项保持开放。VIP模式3原倍率资格不足，生命吸收撤回。
