# Pet2 10231 受击移动来源合同

M4-10/FUNC-01/Trigger5，政策见[pet-hit-speed-policy.md](pet-hit-speed-policy.md)。原skill.dat 10231“大麦耍赖”Info“被击中后5秒，移动速度+10。”；Trigger5/Target1/Range0、Func1 T5且XYZ0、ItemMove1，其他数值属性0。原首Effect110/SE42/tag0/method3，后两effect/sound0，字段不等同原sender已恢复。原petskill10231等级1/花费10，两个原row全文保存于[pet-hit-speed-preparation.json](../output/pet-hit-speed-preparation.json)。

合法来源为10211网页最终browser-pet-kill-heal-2026-10-06T02-23-56-449Z checkpoint/private，pet-kill-heal-root-review已亲收。host保持selectedPet102/10711；peer保持旧Pet2 instance3，槽0已学10211、槽1已学10221全文保持，槽2 base+0x4c=10231/rank+0x64=0。仅peer预服务Point10明确非earned，普通Select旧3及LEARN槽2消耗10；无新Pet、食品、资金或owned夹具。初始完整四QUERY除该Point及相应价格资格重算外全文等原最终cold。

原装备及extra技能筛选只自动采用Trigger0/Func1 T65535，因此学会10231不构成受击执行。正式Web消费者在目标接受敌对非self伤害、实际HP下降且继续alive/status2/HP>0/attributesReady时，验证所选ownedPet2槽2rank1，将原10231安装到current16槽空位并重算；技能槽满不提升，重复受伤刷新同一期限而不叠加。5server秒到期在actor运动前只移本状态技能，death/Leave/FINISHED/start/respawn清，库存/学习/账户不写战斗瞬态。门禁及安装/刷新/时序是明确Web政策，原Trigger5/Func1 dispatcher未知。

统一数字沿recomputeQualifiedRoleMovement：原432951 int32累加ItemMove1，DataScale14/15限幅；有效精通及坦克类型保持原统一选择，moveUnits=(mastery+limitedMove-3)|0，speed=f32(moveUnits*f32(moveScale)+50)。既有构造moveScale10，因此未触限幅的本source提升10源单位/秒；没有另写战车速度。ItemTurn0故turn相同。实际130→140及约.6806783676147461rad/s由root工程实源确认，网络仍使用完整所选owned、装备、六槽、current技能与DataScale独立重算，不硬填这些数作为oracle。

3670普通网络两房：未学自然受伤current仍无10231，普通前进500ms按完整基线源测距离；下一WAITING peerReady后正常LEARN槽2/双方Ready取消，正常开局受伤current10231一次，再500ms测实际来源增量；等待首个5秒到期快照并保存最后活跃双帧，current撤回及统一重算回基线，再500ms前进证明恢复。owner先普通转向并倒退至少100后停，留出peer两段短直线走廊，所有运动均由普通input取得。模拟tick/serverTime/wallTime分别记录，位置投影2位误差按500ms窗口速度容差.3源单位/秒；碰撞造成不符仍FAIL，不扩大容差。

每房自然普通2001单hit，critical布尔沿完整原攻击与FRONT防御独立damage/intHP；当前4020原门禁保持。源资格/伤后/current有效与撤回三状态全文保，双snapshot同键、所有共同帧/事件全文等、四Leave。最终host完整账户不变，peer仅Point消耗与旧3slot2rank1、soleLEARNreceipt，旧10211/10221与所有owned/inventory/七hotkeys保持；learning全文等正式学习后。双完整native及全部原receipts，新LEARNreceipt独立核，真正同tempDB停启双四QUERY恢复，checkpoint/private0600与finally删除临时库。已完成必要targettypes与唯一普通first，复用rootbuild，不新增pure；重复刷新、槽满、死亡与更多生命周期范围分列root工程，有限网络不冒全范围。

正式消费者pet-hit-speed.ts及PlayerState/start/World接线由root完成，pet-hit-speed-engineering.json登记consumer/World与受影响10211World回归actual0、productiontypes4480actual0、build12713actual0/releasecopy冻结。此工程与有限普通3670证据分列，网络独立主审已收，网页与最终主审仍待收。

3670唯一first93331实际exit0，targettypes3210实际exit0；raw pet-hit-speed-network-2026-10-06T02-35-29-950Z.json接受`PASS_FINITE_ORDINARY_EXISTING_PET2_LEARN10231_HOSTILE_INJURY_SPEED5S_EXPIRE_BASELINE_MOVE_READY_DUAL_STATE_NATIVE_RESTART_SCOPE`。双房sole普通非critical127.10765255670468使peer700→572；owner正常退让105.0061。三个10tick/.5sim秒移动窗口：未学64.9981/129.9962源单位每秒、学后70.0017/140.0034、到期65.0006/130.0012；独立公式130/140/130，turn保持.6806783676147461。5秒首次撤回lastActive198/firstExpired199，sim5/server5031ms/wall5026ms；未把墙钟当固定5s。共同完整快照112/215及事件全文双等，四Leave、双全native/七hotkeys/新学习receipt与所有原receipts、真实同DB停启四QUERY等；checkpoint229376B0600/identity0600，finally删除临时库且亲3670空。root网络独立审已接受，网页及最终main仍pending，重复刷新/致死等工程范围与此singleinjury普通范围分列，原Trigger5/Func1/Effect110/SE42/fullparents保。

网络独立主审[pet-hit-speed-network-root-review.json](../output/pet-hit-speed-network-root-review.json)接受`PASS_FINITE_ORDINARY_EXISTING_PET2_LEARN10231_HOSTILE_INJURY_SPEED5S_EXPIRE_BASELINE_MOVE_READY_DUAL_STATE_NATIVE_RESTART_SCOPE`：327共同完整快照、真实130/140/130运动、完整SQLite所有表独立expected及普通history payload、双完整原生四QUERY及真实同DB重启已收。只学习旧3槽2、Point10消耗与sole新LEARNreceipt及正常结算改变，库存/旧10211/10221与全部其他owned保持。网络范围有限闭合，网页3671/main仍pending；原Trigger5/Func1/Effect110/SE42及完整父范围继续开放。

网页首轮有限主审[pet-hit-speed-browser-first-root-review.json](../output/pet-hit-speed-browser-first-root-review.json)接受`ACCEPTED_FINITE_LEARNED_PET2_10231_HOME_READY_NATIVE_TURN_SOURCE_ONLY_INJURY_MOVE_CLOSE_RESTART_UNREACHED_SCOPE`。77049原exit1/FAIL保留：Home所选旧Pet2槽2rank1、双Ready与原生普通转向来源已达；0hit/0event，SQLite全部表完全保持。普通受伤、加速移动、期限撤回后移动、Leave/HomeClose及同DB重启未达，不以首轮转向来源冒该技能网页业务完成。必要尾段复用其真实保存库补未达普通输入与authority状态，main/browser继续pending，原网络93331PASS独立保持。
