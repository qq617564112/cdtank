# Pet2大麦偷袭10221来源合同

M4-10/FUNC-09的具名玩家缺环。原Pet2表普通购价3500金币，六技能中的slot1为10221，等级上限1。原PetSkill价格表10221/group10221/level1的花费技能点数为200。合法拥有Pet2后可经现有PetSkillLearning LEARN(instanceId,slot1)把rank0升为1；技能点取得尚未恢复，未来验收若提供Point200，须明确为预服务非earned点数，不能以学习成功证明点数获得流程。

## 资格来源

拥有base记录slot1的baseId为+48，rank为+60，分别来自六槽+44+slot*4与+5c+slot*4。当前技能ID按baseId+rank−1：base10221/rank1对应10221，rank0没有该学习资格。所选拥有实例由profile+a4与OwnedRoles完整base记录确认；BattleRoleSources.snapshot().base.fields保存所选拥有源的冻结副本，RoomSnapshot.roleSkillSources.equipmentSkills公开同源六槽baseId/rank。该拥有槽不是current16槽，也不是属性被动selectedSkillIds。

原4335b5–4337d7/getter4227d8对独立boundGear读取六槽，见 `pet-skill-binding-source.md` 与正式 `roles/skill-sources.ts`。原角色+a0安装producer缺口保留；Web所选拥有源的正式绑定不等于原指针生产者已恢复。原49380b下一等级请求、PetTable槽上限、价格字段+18与成功回包rank增量见 `pet-skill-learn-contract.md`。本合同不重新执行原native或学习交易矩阵。

## 原表输入

| 记录 | 已确认字段 |
| --- | --- |
| skill10221 大麦偷袭 | Info：打到敌人背面且判断为Critical的话，则直接将敌人一击必杀。Trigger0，Target1，Range0；Func9 T0/X0/Y30004/Z0 |
| skill10221属性 | 所有数值属性为0；没有Func1/Tffff，不能按属性被动筛选通过 |
| skill30004 背后偷袭扣血 | Info：skillID=10221调用扣生命值400。HP=-400；Trigger1，Target1，Range0；Func2 T0/X0/Y0/Z0 |
| skill30004效果 | 三槽effectId0/sound0，不据Y30004推断新增视觉效果 |

目录来源为已发布 `recovery/output/web-assets/combat-catalog.json` 的PetTypes、PetSkillPrices与Skills，复用原表导出。`roles/skills.ts` 的原属性被动谓词要求Trigger0及Func1/Tffff；10221虽Trigger0却只有Func9，不能通过该谓词，也不能补塞currentSkills绕过筛选。功能消费者须明确读取合法拥有slot1/rank1，并保持属性被动来源与条件生命作用分开。

## 正式消费者与原执行来源边界

现 `battle/shot-critical.ts` 按当前合格角色概率在真实敌对命中判critical，`life.ts` 再消费方向防御与现有整数HP链。正式 `battle/shot-back-critical.ts` 与 `life.ts` 已读取合法10221学习资格及Y30004的HP=-400，按下述Web政策执行条件生命作用。已有samehit critical布尔值和实际来向相对target.bodyYaw的BACK分类可作为条件输入；它们不证明原Func9的实际门禁、时序或目标调用。

原10221宣传Info的一击必杀与被引用30004的固定HP=-400必须同时保留。原Func9/Func2分派尚不足以确定400是否追加或替代普通命中伤害、是否经过防御，以及“一击必杀”是否只针对原生命范围。正式Web政策已选择既有critical与方向防御之后额外直接扣400，具体组合与防御位置属于重建；不把它称为原Func9执行恢复。Y30004锁定具名数值引用，不新增效果、概率或隐藏倍率。

未来玩家终点是普通学习资格生效后，同一真实敌对ammo命中满足critical且BACK时执行已明确的条件生命作用，并沿现HP、击毁、得分、HPDrain实际整数损失及双端事件链；未学习、非critical与FRONT/SIDE保持既有行为。正式纯函数与普通driver准备已落，首次来源FAIL与必要尾段actual均保留，有限普通联机结果如下；父项保持未完成。

## 正式Web政策与候选接口

合法敌对nonself ammo hit通过既有friendly、immune与counter门禁后，读取当前attacker.attributesReady及所选owned Pet2槽1的base10221/rank1。由同击已判定critical与实际来向BACK决定额外生命作用；动态弹使用现真实命中来向，不增加另一次随机判定，也不冻结开火时的宠物资格。

保持现critical+facet damage，随后直接扣400当前HP；同一个hit.value公布既有damage+400。HP使用现整数setter/clamp，actualLoss=命中前整数HP−最终整数HP；击毁与HPDrain按这一次实际损失处理，不根据未限幅的damage+400造额外恢复。未合格、非critical与非BACK额外值为0。400来自skill30004.HP=-400，额外值不再过防御，也不乘critical或食物恢复率。不任意归零HP，不追加hit、skill FX或属性current/selected槽。

数值线正式纯函数 `apps/server/src/battle/roles/qualified-back-critical-bonus.ts`：`calculateQualifiedBackCriticalBonus(critical: boolean, facet: 'FRONT' | 'SIDE' | 'BACK', qualifiedBonus: number | undefined): number`。仅当critical、BACK与defined同时成立返回qualifiedBonus，否则0；正式caller从合格30004源取得400，不合格传undefined。纯函数不读PetId、拥有表、时钟、随机或当前HP。专属 `tests/qualified-back-critical-bonus.cts` 唯一actualexit0，覆盖非critical、FRONT/SIDE、undefined与BACK400/defined0；输出 `recovery/output/qualified-back-critical-bonus.json`。root负责资格provider、命中生命链、同hit事件与实际HP损失。

## 普通学习准备方案

沿已合法保存的3649网络checkpoint `supply-healing-network-2026-10-05T23-53-12-130Z` 及同stem私密双账户；同伴的原合法Pet2为已学习槽1的实例；学习验收须经普通BUY3500取得新Pet2并选择，新六rank0是既有Web建档政策，不降旧拥有等级或注入角色、资金。首准备已在服务启动前为同伴profile提供Point200非earned点数，定向尾段沿首actual保存库复用，不再写点数。本人普通UNEQUIPslot1的17061保留库存与购买凭据，避免周期恢复干扰实际生命账；这是合法玩家动作，不修改活跃HP。

第一正常房核本人Pet105与同伴Pet2完整拥有源，未学习slot1/rank0时普通A/D把本人背面朝向同伴、方向键普通瞄准，以任一自然2001命中的同击critical布尔值按原raw攻击、BACK防御与整数HP核既有伤害，无额外400。正常双Leave后第二房WAITING同伴Ready，普通LEARN(slot1)花200并等待双Ready取消、六槽rank1同步；10221仍不进入current/selected属性被动。正常Ready后同样自然背面命中，bounded自然sample观察非critical维持既有伤害与critical时damage+400/整数HP损失。学习后最多20个自然accepted sample，每次命中后正常双Leave/newroom恢复生命与已知LOS，避免低HP死亡后的远距复活；不注入位置或固定RNG。

该首次实际拟记录每次完整原属性来源、Pet2槽1/rank、当前critical布尔值、target.bodyYaw/真实bearing/独立BACK判定、hit浮点value、整数HP及得分/击毁账，双方完整共同key快照与关键hit事件，分别记录模拟tick、serverTime和墙钟。各实际房正常双Leave后完整QUERY/native双资料、拥有六级、17061保留记录与学习receipt，再实际同路径stop/start认证比较双完整四QUERY。已有普通critical、方向防御、学习交易矩阵复用；未学习/FRONT/SIDE、缺资格、friendly/immune/counter/periodic等工程规则由root专属消费者覆盖，不重包装旧网络矩阵。正式driver `tests/pet-back-critical-network.cts` 已执行唯一首次与必要尾段，结果分列如下。Room数量取决于取得普通与critical样本的自然结果，不称只有两房或固定四Leave。


准备输出 `recovery/output/pet-back-critical-preparation.json`；成功字面为 `PASS_FINITE_ORDINARY_PET2_LEARN10221_BACK_CRITICAL_EXTRA400_DUAL_STATE_NATIVE_RESTART_SCOPE`，端口3652，公开协议不新增。root负责compiled冻结与共享窗口协调后再执行唯一first。


## 首次有限来源与必要尾段

首17007 actualexit1，原raw `recovery/output/pet-back-critical-network-2026-10-06T00-08-37-083Z.json` 保留。该合法源同伴只有一只Pet2 instance2，slot1/rank实际1，不能作为rank0普通学习起点；phases0，未进入房间、购买、卸装或学习。双方旧拥有记录保持；peer仅按首fixture保存Point200。backup204800B/private0600、cleanup和3652亲空已收。独立首主审 `recovery/output/pet-back-critical-network-first-root-review.json` / `ACCEPTED_FINITE_EXISTING_PET2_SLOT1_ALREADY_LEARNED_PRE_ROOM_SOURCE_UNREACHED_SCOPE` 只接受该来源资格边界，不证明条件命中或学习。

唯一必要尾段从首actualcheckpoint/private复制，`PET_BACK_CRITICAL_TAIL=1`，不再准备Point、资金或拥有夹具。普通PetShop BUY2 MONEY3500→Select新实例，原Pet2全文保留；新购六rank0，来源PetTable Critical20由正式购入写owned+34=20，故有自然critical资格而无须另学slot0。正常UNEQUIP17061与原计划的baseline、slot1学习及最多20个自然learned样本继续未达范围。新Pet2其它等级0会改变有效精通和属性，攻击力完全按新实际完整源计算，不复用旧151。final/native严格核新购receipt、旧Pet2全文、完整新Pet2仅slot1rank1、profile仅普通扣3500/所选实例/Point变化，以及学习QUERY全文等afterLearning.state.learning；真正同库stop/start保持。

尾段必要syntax exit0，独立新增PetShop/Select请求的targettypes1493 exit0，首targettypes98082 exit0保持独立。compiled5884与公开schema保持，唯一必要尾段41826 actualexit0。


## 普通条件命中有限结果

必要尾段raw `recovery/output/pet-back-critical-network-2026-10-06T00-14-02-485Z.json`，汇总 `recovery/output/pet-back-critical-network-analysis.json`。普通购买新Pet2 instance3花3500，六级0；选择后普通学习slot1花既存200点，Point0/rank1。旧Pet2 instance2与六级全文保持。普通卸下17061保库存，不使用周期恢复掩盖生命变化。

四房均为真实背面来向。未学baseline自然false、伤害118.80409135586184/HP700→581；学习后三个自然样本false、false、true。false保持同普通伤害，true为237.60818271172369+400=637.6081827117237，HP700→62、实际整数生命损失638。该结果符合固定400组合，不是任意HP一击归零。新实际源独立重算raw151是验收结果，不是driver硬常量。各房18个共同完整snapshot逐值相等，共8次普通Leave。hit浮点值/critical布尔值双同，无额外heal或itemUsed；各样本分别记录模拟、服务端与墙钟时间。

完整原生保存包含双方profile/inventory/owned、原Pet2全文、新Pet2仅slot1rank1，以及新PetBUY/学习完整receipt；实际同一路径stop/start后双方完整四QUERY等保存终点。finally备份208896B/private0600、临时库删除/服务停止且3652亲空。UI3653合法来源为同stemcheckpoint/private，独立normal BACKbase118.80409135586184、critical合计637.6081827117237。网络独立主审 `recovery/output/pet-back-critical-network-root-review.json` / `PASS_FINITE_ORDINARY_BUY_PET2_LEARN10221_BACK_CRITICAL_REFERENCED400_DUAL_STATE_NATIVE_RESTART_SCOPE` 已收；页面及最终合审已收，范围如下；原Func9/绑定/earnedPoint与完整父范围保持开放。

## 正式页面与最终有限合审

最终主审 `recovery/output/pet-back-critical-root-review.json` / `PASS_FINITE_ORDINARY_BUY_PET2_LEARN10221_BACK_CRITICAL_REFERENCED400_TOTAL_TEXT_DUAL_STATE_NATIVE_RESTART_SUMMARY_CLOSE_SCOPE`；页面独立主审 `recovery/output/pet-back-critical-browser-root-review.json` / `PASS_FINITE_LEARNED_PET2_10221_NATIVE_BACK_NORMAL_CRITICAL_REFERENCED400_TOTAL_TEXT_DUAL_STATE_SUMMARY_HOME_CLOSE_SCOPE`。网络独立主审路径保持。

页面actual98590 exit0，raw `recovery/output/browser-pet-back-critical-2026-10-06T00-20-19-799Z.json`。正常Home装备页取得本人Inventory与Equipment响应，确认17061 state0、slot1空；六个新普通房取得五次普通BACK118.80409135586184/HP700→581及一次自然Critical BACK637.6081827117237/HP700→62。双端命中完整snapshot/hit全文相等，网页各自connection tick的players全文一致。每击每页只有一条总伤害文字及一个队列记录，原整数文字分别为-118/-637。各页保留1000份snapshot是截取保留量，不代表完整session计数。

十二次原phase普通Leave及最后双HomeStrictClose完成，Runtime异常0。原生八个business表全文保持，仅正常结算增加settled_matches6与match_history12；checkpoint212992B/private0600，四finally清理与三端口空由页面主审确认。首页面5920 FAIL只接受Pet2所选学习资格与Home说明，hostInventory先决响应及命中由必要尾段完成；该首raw和网络17007来源FAIL分别保留。原Critical渲染证据复用，本片只验证单次总伤害文字消费者；原Func9/Func2执行组合、技能点取得、绑定producer及完整父范围仍未完成。
