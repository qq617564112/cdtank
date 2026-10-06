# M2-02/M2-03 黏胶4006独立运动规则验收

原skill4006为TriggerType8、FuncType1/FuncT15、ItemMove−6；item2008引用2008/4006。原item描述10秒与skill字段15秒冲突，时长合同按实际命中skill4006字段，权威安装/期限和库存生命周期由主线负责。本片不执行或推定服务端命中producer。

`tests/tank-ammo-slow-movement-rules.cts`使用生产`RoleCombatState.addSkill/removeSkill`写当前array4，再调用`recomputeQualifiedRoleMovement`。原4335ca–4335fb当前16槽逐项累加不受432b29装备被动筛选限制；4006不是passive，但真实安装到当前槽后会按432951倍率1累加ItemMove−6。移动合成值先按datascale14限幅1～17，然后使用显式owned+34条件/实际TankType精通及原f32转换。原对应选择、1026技能倍率、完整564重算向量直接复用，不重执行EXE。

| 明确来源条件 | 基础速度 | 安装4006 | 4006与skill6并存 | 仅skill6 |
| --- | ---: | ---: | ---: | ---: |
| tank3/pet2/+34=0，有效精通1 | 130 | 70 | 130 | 190 |
| tank104/pet2/+34=0，有效精通3 | 80 | 60 | 80 | 140 |

第二行TankMove3−6低于1，按原下限处理，因此实际减少20而非无条件减少60。并存时+6/−6先相加再限幅；两种安装顺序、先移除减速或先移除加速均检查。两辆车所有条件turn分别保持0.6806783676147461与0.6108652353286743；没有修改运动公式或消费者。

主线指定的既有`world-role-attributes-native.json` tank1/part0实际fixture另由`--native-fixture-only`单行读取：base定义pet1、equipment定义tank1、owned+34=1，boundGear保持缺失。使用正式`readRoleSkillSources`读取实际装备与角色numeric字段/current array4，普通2001安装后统一输出baseline speed150、turn0.7504915595054626；安装4006输出speed90、同turn；移除恢复speed150。15秒仅从4006 FuncT读取，期限实际恢复由network验收，未执行模拟计时。独立产物`tank-ammo-slow-native-fixture-rules.json/.log`及`-types.log`均PASS；未复跑其他车型、旧向量或旧两条件。此行是明确原向量拥有资料夹具，不是正常取得或原默认配装。

`tank-ammo-slow-movement-rules.json/.log` PASS，专属strict NodeNext `tank-ammo-slow-movement-types.log` exit0。这里仅为局部规则验收，不是正常取得、实际命中、15秒恢复、库存消费、双端或持久业务验收；主线另交正式2008消费者链。pet拥有没有赋boundGear，+34=0为显式条件，不确认原购买默认。状态沿M2-02/M2-03原位由主线集成，父项不关闭。
