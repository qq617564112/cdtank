# M2-01 独立生命计算资格

`roles/recompute-life.ts`的`recomputeQualifiedRoleLife`只消费明确ownedHp（实际所选宠物拥有记录+2c）、实际RoleSkillSources、技能/物品表、原限幅表、getter9计数及明确VIP身份。普通身份不读取VIP倍率；非零VIP字节必须有明确倍率，否则拒绝。缺ownedHp/currentSkillIds/datascale1/VIP身份也拒绝，缺失不补0，不伪造宠物拥有或绑定。

输出仅maxHp与selectedSkillIds，不输入当前HP，不执行治疗、出生或复活，不清完整属性dirty。缺攻防、暴击、Lucky或运动owned+34不属于生命公式依赖；独立来源消费者必须仍验证实际选择/拥有及技能来源，不把selected pet视作boundGear。

## 原直接来源

| 字段/入口 | 确认规则 |
| --- | --- |
| 4334e8–4335b2 | 实际owned pet+2c int32初始化record+58 MaxHP |
| 4335b5–4337d7 /432b29/432fe8 | 共用原16当前槽、独立装备六组等级、额外技能及item source选择，重复与生效资格保持 |
| 432951 | Skill.MaxHP按原倍率int32乘后int32加，不消费显示攻击力或攻防字段 |
| 4337d7 | datascale1上界后下界限幅 |
| 433cf4 | VIP低8位非零时，限幅后再int32乘明确倍率；原正常身份不乘 |

HP为整数生命单位，没有时间/坐标单位换算。getter9–FuncZ1正差倍率仍由共用roleSkillMultiplier消费者实现；baseId+rank−1与原被动规则共用selectRoleSkills。四helper同时由完整重算和独立生命调用，保持原HP在其他字段之间的执行顺序，独立入口不复制最终常量。

## 原向量与局部检查

`tests/tank-life-qualification.cts`复用原role-recompute-native.json与实际owned-base/paired记录解析，563完成生命向量（其中376显式native VIP倍率）、1原缺技能拒绝全部匹配maxHp和selectedSkillIds。额外缺HP、VIP身份、当前技能槽、id1及未知VIP倍率拒绝；normal无需倍率，vip=256低字节0按normal执行。显式native倍率向量只证明公式，不证明正式VIP倍率producer。

共用抽取影响完整重算，本轮对应完整564重算/通知/dirty、254缺源状态保留及16parsed pair→Account persistence→battle source getter原合同通过，未重执行native。focused strict Bundler类型通过；NodeNext首次TS2835来自既有recovery/evidence/roles/role-owned-sources.ts相对ESM无扩展路径，原日志保留，不修改无关证据模块。

证据：tank-life-qualification.json/.log、-full.log、-types-bundler.log；首次-types.log保留。没有复跑已过运动/弹药/全部build或五模式。

## 正式接线与未完成范围

主线负责attributes/life/player-state/World接线及独立lifeReady；本线只交计算模块和批准的recompute-base初始化、recompute-skill MaxHP累加、recompute-limits id1/VIP尾共用抽取。正式玩家可见验收仍需实际购买宠物来源→独立生命资格→出生/自然死亡复活maxHp→双端，且自然战斗中重算不得无端回血；module PASS不能代替此联机范围。

原VIP倍率producer未取得且调查暂停：本模块明确拒绝未知倍率，不继续扫描或猜数，不阻已确认普通弹药/运动。原新账户资金/profile、零价tank1/pet1取得以及owned购入字段初值仍缺；购买存在但其数值建档为已登记重建规则。role+a0独立六技能绑定写入口仍缺且按既有两次停止条件保留，不从选择记录推断驾驶或生命技能生效。攻防独立资格已通过armorReady/recoveredArmor正式接入，原最终伤害公式未恢复。M2-01/02/03父项均保持未勾。

## 正式生命周期首验准备

`tests/tank-life-purchased-network.cts`已准备并focused NodeNext strict类型通过，准备阶段未执行实战，最终结果见下节。真实guest只给明确资金profile100000，正式BUY tank3/pet2/2007→SelectRole/Kitbag→mode4/map7普通非VIP，普通CPU154自然受击后用2007/2001选择触发重算，断言生命不增加且maxHp维持实际源值，随后自然死亡复活/双端同步及正常Leave。自然死亡未发生时保存原FAIL与缺环，不修改HP/来源/事件。

普通完整购买记录不能证明缺攻防支路；主线另own专属稀疏资格断言。正式lifeReady接线已由主线落attributes/create/player-state/start/projection/World，首次联机运行以稳定接线与对应类型结果为前提。此准备项不能登记玩家通过或关闭父项。

## 正式购买自然生命周期首验

`tank-life-purchased-network-2026-10-04T16-49-11-651Z.json`PASS：两个真实新Account零拥有库存起点，guest仅明确100000资金profile，tank3/pet2/2007分别实际BUY、SelectRole及Kitbag；normal mode4/map7与普通CPU154自然战斗。期望owned pet+2c=700经真实2001/4020技能生命计算为700。选择2007仅触发正常技能/属性重算，不发射或消费它，最终库存仍1。

| 阶段 | tick | HP/maxHp | 弹药 | 服务端ms | 接收墙钟ms |
| --- | ---: | --- | --- | ---: | ---: |
| 正常出生 | 1 | 700/700 | 2001 | 1791132553442 | 1791132553450 |
| 自然命中 | 10 | 650/700 | 2001 | 1791132553896 | 1791132553899 |
| 切特殊弹重算 | 11 | 650/700 | 2007 | 1791132553946 | 1791132553947 |
| 切普通弹重算 | 12 | 650/700 | 2001 | 1791132553995 | 1791132553997 |
| 自然死亡 | 700 | 0/700 | — | 1791132588597 | 1791132588599 |
| 自然复活 | 760 | 700/700 | — | 1791132591612 | 1791132591614 |

自然受击700→650后，两次普通切弹重算仍650，上限700；自然死亡0/700到复活700/700，间隔60tick/3模拟秒、3.015服务端秒、3.015接收墙钟秒。两端760共同tick全players一致，双方普通Leave、server/db临时资源cleanup，专属strict类型PASS。此一真实组合只证明正式购买生命与不无端heal/自然复活，不以完整购买记录代替缺攻防稀疏资格支路；后者主线专属局部断言另登记。原native及本轮共用向量不复跑。索引tank-life-player-accepted.json仅此scope，M2父保持未勾。

## 拥有期限字段来源补充

`owned-tank-duration-mastery-source.json` 通过原MyTank getter4d88f1与3aab handler428ec5/gamestring875，确认owned+34为剩余分钟；0条件的四类精通减1下限1仍复用原数值消费者。原购入初值、期限扣减和维修恢复producer未确认，现BUY写0仍明确重建。字段含义不再列为未知；不扩大已验角色组合或改变正式数值行为。
