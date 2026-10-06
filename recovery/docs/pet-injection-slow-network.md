# 注射剂解除已交付黏胶减速

M4-10-I03-B / FUNC-10 / M2-03。主线负责 `pet-injection.ts`、`accept-input.ts` 及 `clearAmmoSlow` 参数范围；数值线负责新 `pet-injection-slow-rules.cts`、`pet-injection-slow-network.cts` 与本专题证据。旧燃烧、购买、表现、重启验收沿原索引复用。

| 来源类别 | 本片采用的合同 |
| --- | --- |
| 原配置直接确认 | item3 说明解除所有异常；skill3 Trigger1/Target1/Func10、HP0；skill4006 Trigger8/Func1.t15、ItemMove−6。原表定位与字段见 pet-injection-source.md、ammo-slow-business.md。 |
| 原公式与执行确认 | 当前16技能槽选择由4335ca–4335fb累加；4006不受装备被动筛选限制。移除4006后沿已证移动合成、datascale14限幅、精通、单位和f32顺序重算；见 tank-ammo-slow-movement-rules.md。 |
| 原客户端行为测量 | 本片未新增原客户端测量；统一运动既有原向量直接复用。 |
| 服务端重建 | 存活/status2自用、burn或ammoSlow资格、CAS先成功再同时解除、从当前槽移除4006与发布itemUsed。原Func10全部异常枚举、目标授权及清除producer未恢复。真实购买可用性及owned+34初值也属重建。 |

正式链为普通Kitbag槽4 / useItem5 → acceptBattleInput → dispatchItemHotkey原请求资格 → applyPetInjection → 实际账户CAS → clearAmmoBurn / clearAmmoSlow → removeSkill4006 → recomputeBattleAttributes → 既有权威运动 / RoomSnapshot。减速期限仍取4006的15秒；item2008说明10秒的差异沿已有记录，本次解除在到期前进行。

局部八条件覆盖单独slow、同时burn、CAS拒绝、保存异常，各与正面skill6并存及不并存。成功仅重算一次，失败不改库存、异常、技能槽和移动；生命保持620，正面对象/skill6保持；再次无异常使用拒绝。产物 `pet-injection-slow-rules.json/.log`。此局部记录不是正常取得或真实命中证据。

真实runner只使用两个空账户与100000资金profile夹具，其余拥有/库存为空。TankShop BUY3、PetShop BUY2与SelectRole生成实际来源，Shop真实购买2008一份和item3两份，分别配置槽1、槽4。普通前进测基线、炮塔输入瞄准并发射2008自然命中、目标普通前进测减速、useItem5解除后普通倒退测恢复、重复使用拒绝、正常Leave。预期速度由真实购入的tank/pet字段、`readRoleSkillSources`及统一重算模块生成，不逐车填最终常量，不推定boundGear。

每段保留六个连续权威快照、五个模拟tick（0.25秒），累计实际XZ距离并分别记录模拟时间、serverTime差与接收墙钟差；速度误差要求小于0.1单位/秒。全共同tick双端players逐值一致，注射不改变HP/maxHp，库存2→1后重复仍1。该检查只覆盖实际tank3/pet2/无部件组合。

未完成范围：原Func10全部异常与服务端producer、AI仅slow时自动注射资格、原完整伤害/绑定/购入初值及父项。无需扩大旧燃烧/特效/重启或逐配装组合。

## 当前实际证据

`pet-injection-slow-network-2026-10-04T21-56-07-916Z.json` PASS_PURCHASED_SLOW_INJECTION：真实tank3/pet2购买选择、2008与注射剂库存取得、自然命中44.76后HP655、普通useItem5解除、重复无异常拒绝与库存保持1、112共同tick双方players一致、两次正常Leave及服务清理。

| 普通输入阶段 | 距离 | 模拟秒 | 服务端秒 | 墙钟秒 | 速度（距离/模拟秒） | 原模块预期 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 前进基线 | 32.503078 | 0.25 | 0.252 | 0.252 | 130.012311 | 130 |
| 前进减速 | 17.496142 | 0.25 | 0.250 | 0.248 | 69.984567 | 70 |
| 注射后倒退 | 32.504809 | 0.25 | 0.252 | 0.254 | 130.019236 | 130 |

局部八条件PASS，专属strict NodeNext类型exit0。主线正式server types/build及旧burn回归分别为 `pet-injection-slow-server-types.log`、`pet-injection-slow-server-build.log`、`pet-injection-slow-burn-baseline.log`，不重复其检查。索引 `pet-injection-slow-player-accepted.json`保留原21-55-04整体FAIL及当前有限PASS，主线已亲审runner与原raw，限定接受上述恢复/消费/同步范围；原失败记录不能作为完整成功对局。
