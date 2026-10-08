# Pet4最后一搏10441来源合同

M4-10/FUNC-11/M6-04已有有限玩家consumer与生产接线，完整原来源及父项未完成。原Pet4普通价格4500金币，六槽baseIds为10411/10421/10431/10441/10451/10461，各槽上限6/5/5/1/1/0。slot3技能10441/group10441/level1的原学习费用200。现有PetShop普通购买、SelectRole和PetSkillLearning可提供合法新Pet4与slot3/rank1；新购六rank0为既有Web建档政策。结算技能点已接入`account_growth.skill_points`，与宠物学习扣款共用同一余额；原技能点source及“新earned→learn”端到端证据尚未取得。验收若使用预服务Point200须明确非earned，不降旧等级或注入拥有记录。

原skill10441名为“最后一搏”，Info为“就算生命=0，还可以再多活3秒才爆炸。” Trigger6、Target1、Range0，Func11 T3/X0/Y0/Z0，其余两函数槽为0；全部数值attributes为0。T3与原文案共同提供3秒持续输入，但原Trigger6调度与Func11时间写入/最终爆炸调用仍未恢复。`qualifiedLastStand`在本批生产中使用同次选中的source/duration建立原latch，随后只发一次该source首槽；旧`qualifiedLastStandDuration`导出保留。effect43/sound0/tag0/method3仅登记当前首槽通知，没有爆炸伤害、第二槽或retained推断。

所选拥有base的slot3字段为baseId+50、rank+68，来自六槽+44+slot*4与+5c+slot*4。base+68是此拥有记录的rank字段，区别于combat.roleFloatFields+68的Critical概率。合法实例由profile+a4与完整OwnedRoles确认，BattleRoleSources.snapshot().base.fields和公开roleSkillSources.equipmentSkills[3]已有同源provider。读取base10441/rank1可以提出新Web资格，不能宣称原boundGear安装producer已恢复。

10441不是Trigger0/Func1 Tffff属性被动，不进入原selectedSkillIds合成，也不能补塞current16来构造资格。正式Web资格consumer `battle/last-stand.ts` 已接入10441所选拥有源，life/health/World生命周期生产接线已接。普通死亡和3秒复活历史证据不能证明“HP0仍活3秒”；下述普通首次实际证据保留其旧受测版本范围，不替代当前生产接线后的新实测。新终点须由自然致死触发、在HP0时保留明确的临时存活行为，然后唯一最终死亡/击毁/得分及复活双端同步。

## 正式Web时序

政策由 `pet-last-stand-policy.md` 与任务表登记。当前attributesReady及所选Pet4 slot3 base10441/rank1合格时，首次自然HP归零记录authority serverNow+3000，保持alive/status2并允许现正常move/aim/fire，重复hit不延长期限。食物、医疗、周期与吸收禁止恢复，食物拒绝不扣库存。到期只一次destroy/目标death；原致死射手仍在房时才给个人kill/destroyScore，已离开时仍执行目标死亡与团队生命链但不给离开射手个人奖励。原3秒respawn从最终death开始；Leave/FINISHED/start/respawn清阶段，FINISHED不额外制造死亡奖励。

这些组合是明确Web时序重建。首次latch已按同次选中来源发送一次首槽Effect43通知，表现未实测；原Trigger6/Func11调度、治疗组合及原爆炸伤害来源仍未恢复，不新增爆炸伤害或第二槽。原status2由root工程消费者验证，网络只使用现公开alive/HP与真实输入，不增加诊断API或wire。模拟tick、serverTime及接收墙钟分别记录。

数值线canonical `roles/qualified-last-stand-duration.ts` 导出 `resolveQualifiedLastStandDuration(qualified:boolean,durationSeconds:number):number|undefined`，仅qualified返回seconds*1000，否则undefined。caller负责当前拥有源和attributesReady，纯函数不查询宠物、rank、HP、RNG或时钟。专属 `tests/qualified-last-stand-duration.cts` 唯一actualexit0，3→3000、无资格undefined及0/1.5秒转换通过，输出 `recovery/output/qualified-last-stand-duration.json`。

## 可复用的合法普通取得起点

已收10221网络终点 `recovery/output/pet-back-critical-network-2026-10-06T00-14-02-485Z.json` 的final完整QUERY中，本人money70960、points0、owned base数5，包含Pet2/103/3/104/105而无Pet4；同伴money90500、points0、base数2，均为Pet2。本人可沿该已保存checkpoint/private普通BUY4花4500，余额预期66460，base数5→6，旧五个完整拥有记录保持；新实例应按正式购买响应确定，不预填实例号。该起点无需资金或拥有夹具，点数200仍须独立明示为预服务非earned输入。

同伴保留真实已学Pet2来源可提供自然普通/critical敌对2001致死，不复用旧固定151或Pet105生命/防御常量作为新Pet4预期；新所选Pet4的生命、攻击、防御及技能来源须按实际完整字段独立重算。此处只确认普通取得所需合法资金与拥有容量，尚未实施购买、学习、特殊生命时序或服务验收。

## 普通玩家首次验收准备

专属 `tests/pet-last-stand-network.cts` 预留3660，入口 `PET_LAST_STAND_PORT=3660 PET_LAST_STAND_RELEASE=1 node --import tsx tests/pet-last-stand-network.cts`；服务启动必须复用root冻结compiled窗口。普通BUY4/Select新六rank0，完整旧拥有源保持；第一房自然peer2001 FRONT击至死亡，核未学立即death/kill、原respawn及freshfire。第二房WAITING目标Ready后普通LEARNslot3花200，双端Ready清空及rank1同步，不插selected/current10441；同peer FRONT自然致死避免既存Pet2背面10221额外400，critical倍率仍按同hit布尔值独立计算。新Pet4完整原字段独立重算HP、raw、Def与选择源，不用旧Pet105或151硬常量。

致死前如炮手只余末弹，以普通朝空处瞄准开火并正常等末发装填后重新对准，保证致死之后能在3秒内再自然命中。学后HP0仍alive、respawnAt0、death/kill未变；重复hit不恢复生命或延长期限，仍只有正常hitScore。目标在阶段内普通move/turn/aim/fire必须产生真实位置/角度变化与唯一2001 fire事件。到期单destroy/death/kill/destroyScore，三时基记录3秒；之后原3秒respawn、满HP/完整弹匣/零装填/来源保持与新fire成功。每个相同room/round/phase/tick/serverTime共同完整snapshot逐值比较，生命周期关键事件双端完整比较，两房四Leave。

最终两账户四QUERY完整保持仅目标正常购价/所选实例/Point及新Pet4 slot3rank1变化，新BUY与LEARN收据和原生两完整profile/inventory/owned校验，final Learning全文等afterLearning.state.learning；实际disconnect/stop/start同一路径数据库双认证四QUERY全文等终点。finally备份保存checkpoint与0600私密账户，清服务与临时库。native与restart已在下述首次实际完成。

必要transpile语法检查exit0，`recovery/output/pet-last-stand-network-syntax.log`；专属targettypes38376 actualexit0后复用root compiled81287执行唯一first，未新建生产构建。纯模块PASS不等于生命周期实际PASS；本网络未主动调用食物/医疗/周期/吸收或射手离开分支，这些门禁由root专属工程验证，普通scope不冒全组合。

## 普通首次实际有限结果

3660唯一first57664 actualexit0，raw `recovery/output/pet-last-stand-network-2026-10-06T00-33-10-572Z.json`，成功字面 `PASS_FINITE_ORDINARY_BUY_PET4_LEARN10441_ZERO_HP_THREE_SECOND_INPUT_FINAL_DEATH_RESPAWN_DUAL_STATE_NATIVE_RESTART_SCOPE`。汇总 `recovery/output/pet-last-stand-network-analysis.json`。普通BUY4花4500，70960→66460，新instance13六rank0；选择后第一房Pet4 maxHP650，经七个普通FRONT自然命中650→556→462→368→274→180→86→0，未学立即死亡，正常复活后freshfire。

第二房WAITING目标Ready后普通LEARNslot3花明确预服务200点，Point0/rank1及双Ready取消。完整源独立重算peer raw151，普通FRONT伤害93.78881977161026，critical187.57763954322053；151为此次来源结果，不是固定输入。四普通与一critical自然命中使目标剩86，再普通致死时HP0仍alive；额外一次普通命中仍HP0，不提前death/kill或延长期限。阶段内正常200ms输入产生位置(182.31,420.93)→(212.17,418.44)、bodyYaw1.5716→1.8587、aim3.1172→3.1992及唯一目标2001 fire。

归零tick307→最终死亡tick367，模拟3秒/server3005ms/wall3004ms；到期仅一个destroy、一次目标death及炮手kill/destroyScore。最终死亡后再模拟3秒/server3002ms/wall3003ms复活，满HP、完整弹匣、零装填、原学习来源保持与freshfire。第一房复活模拟3秒/server3009ms/wall3009ms。两房400/431个unique共同完整snapshot逐值相等，生命关键事件双端相等，共四Leave；无heal/itemUsed。

原生双方完整profile/inventory/owned及新Pet4 BUY/10441 LEARN完整receipt保持，旧拥有记录全文不变，final学习QUERY全文等afterLearning；实际同路径disconnect/stop/start后双账户四QUERY全文相等。finally checkpoint212992B/0600，private0600，临时库清理、服务停止和3660亲空。UI3661合法源为同stemcheckpoint/private，FRONT普通base93.78881977161026/critical187.57763954322053。网络独立主审 `recovery/output/pet-last-stand-network-root-review.json` / `PASS_FINITE_ORDINARY_BUY_PET4_LEARN10441_FIXED_ZERO_HP_INPUT_REPEAT_HIT_FINAL_DEATH_RESPAWN_DUAL_STATE_NATIVE_RESTART_SCOPE` 已收；页面消费者现已由下述3661首尾有限合审接受，全部父项及原执行来源保持开放。

## 页面首次有限方向证据

页面64968 actualexit1，原raw `recovery/output/browser-pet-last-stand-2026-10-06T00-35-43-975Z.json` 保留。Home已确认所选Pet4 instance13/slot3rank1及10441说明；六次自然炮击后HP0仍alive，保留45份阶段帧。独立首主审 `recovery/output/pet-last-stand-browser-first-root-review.json` / `ACCEPTED_FINITE_LEARNED_PET4_HOME_ZERO_HP_NATIVE_MOVE_TURN_AIM_AUTHORITY_ONLY_ENDPOINT_SAMPLE_UNREACHED_SCOPE` 接受原生W/S、A/D、ArrowLeft/Right真实输入与双端authority变化。ArrowRight实际aim0.123→0.082→0.041→0，首仪器两个端点同0.041遗漏该变化；不据此声称生产inputgate错误。

首scope未证明阶段开火、最终死亡、复活或Close，不能代替完整页面PASS。原生八业务表保持、212992B/private0600及四清理/三端口空由独立首审确认；缺失终点交页面必要尾段，不重复方向采样或网络首次。

## 页面尾段与最终有限合审

最终主审 `recovery/output/pet-last-stand-root-review.json` / `PASS_FINITE_ORDINARY_BUY_PET4_LEARN10441_ZERO_HP_THREE_SECOND_ACTION_FINAL_DEATH_RESPAWN_DUAL_STATE_NATIVE_RESTART_SUMMARY_CLOSE_SCOPE`。页面独立主审 `recovery/output/pet-last-stand-browser-root-review.json` / `PASS_FINITE_LEARNED_PET4_10441_NATIVE_ZERO_HP_ACTION_FIRE_SINGLE_DEATH_RESPAWN_DUAL_STATE_SUMMARY_HOME_CLOSE_SCOPE`；网络独立主审保持原路径与范围。

页面必要尾段17658 actualexit0，raw `recovery/output/browser-pet-last-stand-2026-10-06T00-41-01-750Z.json`。首Home及六方向权威证据严格复用，另建正常新房补终点，不恢复旧session。六自然命中使目标HP650归零，HP0alive阶段本人原生Space106ms产生唯一fire，两页TankView.fire均接受；归零后server3016ms最终单destroy/death/kill，双TankView.life完成false动作09，再server3040ms自然复活true动作01、HP650与freshfire。完整选定samekey快照及各页自身connectiontick的players全文相等。各页retained927/832、共同832是保留窗口，不称完整session快照数量。

原peerPLAYING Leave→hostFINISHED summary Leave及双StrictHomeClose完成，Runtime异常0，未新增交易/heal/itemUsed。原生表全文保持，仅普通结算settled_matches+1/match_history+2；checkpoint212992B及private均0600，四finally清理与三端口空由独立页面主审确认。首64968 FAIL与方向采样边界独立保留；周期、食品、医疗、吸收拒绝及离开射手归属属于root工程证据，网络真实同库重启独立复用。原Trigger6/Func11调度/爆炸调用、Point原始取得与new earned→learn、boundGear安装producer仍开放；本批首槽通知生产已接，首latch后只发一次原首槽，不新增爆炸伤害、第二槽或retained。runtime及HD表现仍未证，集中静态走查已完成；下述历史网络/页面实测范围与旧受测版本保持，全部父项不勾。
