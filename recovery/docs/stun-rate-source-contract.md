# Pet105 受击抗僵直来源合同

11011「不怕痛」是原 Skill 表唯一非零 StunRate：100，Trigger0、Target1、Func1/T65535。原 Info 为「钢筋铁骨，被打不会僵直啊。」该输入指向受击抗僵直。

Pet105「猞猁」原价5000 MONEY，正式 PetShop 正价格目录可普通 BUY。需要本人认证、宠物少于10只、足额余额及房外或可配置 WAITING 状态。购买生成完整 owned instance，六 rank 为0是既有 Web 新生政策；选择需要显式 SelectRole。slot0 原 base11011 位于 owned+44，rank 位于+5c，原上限1。普通 LEARN 使用实际本人 instance/slot0，消耗200 Point，由rank0到1。原 Petskill11011费用记录、所有权及阶段门禁已正式接线；未来预服务 Point200 夹具需声明，不能称正常赚取。

原432951累加 StunRate 到 roleFloat+90。DataScale22「硬直比例」限幅0..100，433c55按f32百分比转换；此技能rank1得到1。消费输入为 target.attributesReady 合格时的 combat.roleFloatFields.get(0x90)，与 recordFields+90 的状态字段不同。

正式重算提供 roleFloat90，root 本片已接 ammo 同 hit 的抗受击动作消费者。2008/4006减速和4001/4002/4003陷阱权限状态独立，不读取此字段。现受击链为 life hit.hurtSelector → Battle → BattlePlayers.hurt → TankView.hurt，并对本地角色触发 ordinaryHurtCamera；伤害文本走独立 damage 路径。

Root 提出的 Web 政策是合格 rate>=1 时省略本 hit 的 hurtSelector，HP、score、critical、drain及伤害文本正常，0或无资格沿现行为。纯 selector 已实现并专项通过；root 拥有 authority 资格门禁与工程，3635 驱动仅准备，普通购买学习与两房实际受击网络已验收，独立主审为 `recovery/output/shot-hurt-resistance-network-root-review.json`。

## 限制

原 BeStun 状态、持续时间、权限影响及与受击动画的等价关系尚未证明。省略 hurtSelector 是明确 Web 重建；原来源不足以建立主动眩晕或移动冻结。普通 BUY105/LEARN11011及同 hit 抗动作消费者已有有限网络实际验收；原 BeStun 等价与全部技能父范围保持未完成。

完整原表记录与具名代码索引见 [source contract](../output/stun-rate-source-contract.json)。

最终有限合审：`recovery/output/shot-hurt-resistance-root-review.json` / `PASS_FINITE_ORDINARY_PURCHASED_LEARNED_PET105_11011_CURRENT_TARGET_ANTI_HURT_ACTION_DAMAGE_TEXT_RESULT_DUAL_STATE_NATIVE_RESTART_SUMMARY_CLOSE_SCOPE`。网络与页面主审独立索引保留，Point200来源、原 BeStun 等价与父范围限制保持。
