# Pet102 10711 被动技能模仿 Web政策

M4-10/FUNC-17。原来源见 pet-copy-skill-source-proposal.md。10711原Info描述击毁后随机模仿对方技能；原服务端候选集合、随机、覆盖与期限未恢复。此片交付已有属性消费者能够执行的被动复制。

玩家普通BUY Pet102/MONEY3500、Select该新实例、LEARN槽0/200Point取得10711；学习点若以预服务账户夹具提供须明确记录为非earned，不注入owned/rank/战斗位置、生命或随机结果。受害者普通学习具名被动，实际已学来源进入候选。

只在统一最终死亡结算的一次敌对击毁后执行。攻击者本人仍alive/status2且完整所选Pet102拥有记录槽0为10711/rank1，原10711 Trigger4/Target1/Func17确认才合格；非本人、mode≤3同team无资格。10441阶段到期的最终死亡同入口，HP0阶段不提前模仿。自然死亡的炸弹归属不使已死亡放置者获得模仿。

候选仅受害者所选拥有宠物六槽rank>0，resolved(baseId+rank−1)满足现isPassiveRoleSkill（Trigger0/Func1 Tffff）；主动与条件技能排除，装备物品技能与受害者当前已模仿技能不再复制。按原六槽顺序保留baseId/rank，非空集合使用一次authority Math.random均匀选择，有候选覆盖唯一combat extraSkill，无候选保留现槽。

写入combat numericFields+88/+8c并标dirty、立即正式全属性重算，沿现selectedSkillIds与攻击、Critical、装甲、运动消费者执行。只更新属性，不补当前HP、不重填弹匣、不重新开启装填；不写账户role_records/profile学习rank。死亡清除、复活前清除、新round及Leave清除，期限为当前生命。现额外槽与所选宠物技能相同的叠加沿原选择器，不添加新堆叠规则。

不新增事件协议或FX派发；双端既有roleSkillSources.selectedSkillIds公开实际被动结果。原Func17服务器执行器、主动及条件复制、Effect12/SE12触发与完整技能范围保持缺口。

root owns battle/passive-skill-copy.ts、World最终死亡/复活/Leave、start清理及正式重算/协议投影消费者与工程验收；Numeric owns roles/copied-role-skill-selection.ts纯选择、原数据、专属规则与普通网络driver；UI owns正式Home普通购买学习来源与自然击毁后双端状态/正常退出证据；FX当前仅复用既有命中/死亡消费者。

完成条件：普通取得学习双方合法技能→自然敌对击毁→合格候选真实选中/双端完整snapshot与网页各connection tick结果→复制被动形成实际Critical或属性行为→死亡/自然复活清除及新round清理→正常双Leave与HomeClose→完整账户owned/profile/learning receipt保存、同DB服务重启四QUERY全文恢复。无资格、空候选、条件排除、覆盖与禁止免费生命/弹药由必要工程检查覆盖。有限切片不关闭原Func17与完整父项。

有限业务证据索引：pet-copy-skill-root-review.json、pet-copy-skill-network-root-review.json及pet-copy-skill-browser-root-review.json。具名消费者为10811食品恢复，网络普通双房200→240→自然死亡复活清除后200；网页正常Home/食品取得和240、自然死亡复活清除、新普通生命200与退出保存分别引用，未恢复旧session。预服务Point200/10为非earned；原Func17候选/期限、主动条件及Effect12/SE12范围保持开放。
