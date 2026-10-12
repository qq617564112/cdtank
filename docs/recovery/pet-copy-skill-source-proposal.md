# Pet102 10711 击破后模仿来源候选

玩家起点：普通PetShop购买Pet102忍者猫，原PetMoney3500/PetCoin350；正式MONEY取得建立新实例六rank0。原Skill0=10711/SkillLv0=1，正常选择该实例后LEARNslot0，原petSkillPrices10711 level1/cost200。学成资格为所选拥有Pet102的base+44=10711、+5c=1，不能由current或selected技能槽替代。

原skill10711“你会我也会”：Trigger4/Target1/Range0，Func17 T/X/Y/Z全0；Info“每次击破敌方坦克时，随机抽选对方的一个技能模仿学习。”首Effect12/SE12/tag0/method3，其余槽0，全部属性0。原表直接确认取得、学习成本与描述，未确认服务器随机算法、候选技能集合、rank处理、覆盖规则、期限与持久化。

正式provider已存在：battle/attributes.ts读取combat.attributeSourceFields的role+88/+8c作为extraSkill，并经roles/skills.ts进入原选择；其appendPassive仍要求Trigger0/Func1/Tffff。现roles/record-defaults.ts把该对字段初始化0，未找到Func17击破后写入消费者。因此复制某个active技能不能仅写extraSkill便声称产生主动行为；复制被动技能也必须正式重算后由现消费者执行。角色瞬态role字段与账户base同偏移不是同一记录，不据同偏移推定持久保存。

玩家终点缺环：所选合法已学Pet102→自然敌方击毁成功→权威选择并写入模仿来源→完整重算→相应已实现技能消费及双端公开来源保持→覆盖/死亡/复活/换局/Leave清理。自然击毁、统一重算和正常多人入口已有，当前缺Func17权威选择及生命周期接线。

候选仅来源准备；未apply规则、pure、driver、类型或服务。待主线确认候选集合、rank与生命周期后确定最小正式行为；不猜Func17等同任意技能复制，不新增公开协议或拥有夹具。M4-10/FUNC-17及完整父范围保持开放。

## 接线决定输入

现extraSkill可直接执行的完整最小候选是受害者所选拥有记录六槽中rank>0且resolved(baseId+rank−1)通过原isPassiveRoleSkill的技能；候选保留baseId/rank，不将resolvedId当baseId再加rank。该集合明确小于Info“一个技能”的完整范围，主动及条件技能复制仍是后续缺口。现复制槽仅一个，因此新增成功应覆盖该槽；无合格候选保持原槽，是建议Web政策，未应用。

主线需确定：是否先交上述被动复制有限闭环，或同步加入已实现条件技能的独立来源provider；模仿资格是否读取当前存活已学攻击者；是否采用权威一次uniform随机；死亡/复活是否撤回，以及newround/Leave必清。这些决定改变真实玩法与共享life/start/respawn，数值线不擅改。

若采用现extraSkill被动闭环，生产输入应为两方真实selected owned记录、最终一次击毁、当前资格与authorityRoll；纯选择返回{baseId,rank}|undefined。root caller负责写combat.record.numericFields+88/+8c、dirty重算及清理，不写账户role_records；recompute现已明确不改变当前HP，只更新生命上限。必须复核现装备/饮料/弹药重算保持，而不因复制免费补HP/装填。

首次验收可选择原装配攻防或移动差异明确且已实现的受害者被动来源，普通BUY102/Select/LEARN0→正常敌方击毁→双公开roleSkillSources的被动skillIds出现及对应自然行为数值改变；沿普通再战/复活/Leave验证主线所选期限，最终两个账户全资料/学习receipt及冷同DBQUERY保持。不用固定RNG、主动位置/生命注入或持久copied-skill夹具。候选中若存在多个技能必须接受自然选择结果并按实际选中源独立计算，不能把某个预期候选当唯一oracle。

## 3001 最终账户与10211候选资格

起点为browser-old-bomb-2026-10-06T01-12-58-627Z实际coldAfterRestart/checkpoint。本人MONEY66400/Point0/所选实例13 Pet4六rank仅slot3=1，拥有base6；peer MONEY90500/Point0/所选实例3 Pet2仅slot1 10221rank1，拥有base2。本人普通BUY102花3500后62900，LEARN10711cost200需明确一次预服务非earned Point200。

指定核验的Pet2slot0 10211“大麦得意”原Trigger4/Target1/Func2T0/HP40，Info击破敌方时生命+40；原pricelevel1cost10，当前rank0。该技能不是isPassiveRoleSkill：不符合Trigger0与Func1/Tffff。学习它无法在已选择的被动复制集合产生候选，不应为该验收交易；10221虽Trigger0但Func9也排除。形成唯一被动候选仍需另一个具名且符合原predicate的真实学习来源；本次未扫描其余技能。仅被动复制政策不等于10211击破恢复consumer，不能将两者混同。

## 指定四槽的正确被动候选

| slot/base | 原触发与函数 | 非零属性 | level1 cost | 被动资格 |
| --- | --- | --- | --- | --- |
| 2/10231 大麦耍赖 | Trigger5/Func1 T5 | ItemMove1 | 10 | 否，条件持续 |
| 3/10241 替我报仇！ | Trigger6/Func1 T10 | Critical2 | 10 | 否，死亡团队持续 |
| 4/10251 中型坦克熟练 | Trigger0/Func1 T65535 | MTankMastery1 | 200 | 是，唯一候选 |
| 5/10261 ？？？ | Trigger6/Func1 T65535 Z30 | Def20 | level0/cost0 | 否，且原cap0 |

10251的原Info为中型坦克熟练度+1。peer现所选Pet2slot4 rank0，正常LEARNslot4成本200可建立唯一符合predicate的base10251/rank1；其已学10221条件技能仍排除。两账户Point0，因此此正常学习验收需本人10711 Point200、peer10251 Point200的两笔明确预服务非earned学习点，不交易10211。

现双方仅有拥有tank实例1/表3，TankType1；10251增加第二类精通，沿recompute-effective-mastery按values[tankType+1]选择，对现Tank3无法产生实际攻防或运动差异。首次观察消费者需正常取得并选择TankType2战车，不能仅以公开复制槽出现声称实际数值消费。该必要取得由主线决定具名车型，未造拥有夹具或扫描其他宠物。

canonical `roles/copied-role-skill-selection.ts`只返回candidates[floor(roll*length)]，候选为空得到undefined，不查资格或修改字段。`tests/copied-role-skill-selection.cts`唯一actualexit0，空集合及0/.499/.5/.999边界、base/rank保持，输出copied-role-skill-selection.json。资格、authority随机、重算与每生命清理由正式provider承担，网络/types/runtime尚未开始。

## 类型2正常取得与可观察终点

原正价类型2的最小购价车型为Tank51“尖嘴蚊”：MONEY3500/TOKENS350，TankType2、Atk130/AtkBonus80、Def17/DefBonus36、Move5/Turn6、Delay−1/Bullet1、SideDef60/BackDef30。本人普通BUY102及BUY51各3500后MONEY59400，Select新Pet102与新Tank51，不造装备拥有记录。

10251使第二类有效mastery增加1。既有原重算消费者直接产生运动speed增加10源单位/秒、turn增加原float32尺度约0.06981317rad/s；attack/defensePercent也沿int仿射mastery因子增加，实际差值须从普通购入ownedAtk/Def字段与f32重算独立导出，不把TankAtk面板直接当伤害。正式攻击后按当前Web攻击/防御/critical链观察自然hit；复制不补HP/弹匣。最终消费者oracle应使用实际购买记录，不强填预想初值。

起点库存实例15qty0/hotkey1可能仍15及old14qty2保，普通测试不发道具输入，不另购买或消耗食品、炸弹；当前装备13001需按实际profile归属资格纳入重算，换新Tank51后不得借旧tank3字段估计。此正常取得方案仅prepare来源与oracle，不执行服务或交易。
