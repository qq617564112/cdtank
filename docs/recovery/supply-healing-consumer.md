# 补给装置17061周期恢复

技能13171的HP20、X3及每3秒恢复20文案作为正式Web消费者输入；物件17061文案50保留来源差异，不覆盖技能字段。原物件类别12、价格1500金币/150代币、Trigger0/Target1/Func2 T999 X3及非属性被动资格复用 `supply-part-consumer-gap.md`，不重新调查原Func2调度。

Web周期政策要求profile.parts、有效库存实例17061/state2/ownedQuantity>0与combat数组2的同槽17061一致。任一合格装备仅产生一个周期；实例集合改变、新局、复活重新计时3000ms。alive PLAYING且lifeReady或attributesReady才消费周期；死亡和FINISHED停止。到期按serverNow单次恢复20并限幅实际maxHP，满血仍推进周期但无恢复事件，不补算漏过周期。恢复事件为本人playerHealed、targetId本人、skillId13171、value实际恢复量；不乘食物恢复率，不消费库存或加分。

纯函数 `apps/server/src/battle/roles/supply-healing-amount.ts` 提供 `calculateSupplyHealingAmount(hp,maxHp,baseHealing)`，返回 `max(0,min(baseHealing,maxHp-hp))`。现输入HP及基础恢复量为整数，无额外round或倍率。专属 `tests/supply-healing-amount.cts` 已exit0，覆盖两次缺血恢复20、近满恢复5、满血与超上限0、基础量0；输出 `recovery/output/supply-healing-amount.json`。周期与资格由root正式消费者负责。

`tests/supply-healing-network.cts` 为3649两房顺序准备。源库为Pet105普通购入/学习已验的23-18-45 checkpoint与私密双账户，资金、点数、角色库存均不注入。普通BUY17061 quantity1扣1500；第一房WAITING本人Ready后EQUIPslot1并等待两端Ready取消。同伴普通2001单击自然缺血，按同击critical布尔值及完整原属性独立核伤害、前向防御与整数HP，随后观察两个20点本人恢复及相隔3000ms周期，分别记录tick差×0.05模拟秒、serverTime差毫秒与收到事件的墙钟差毫秒。正常双Leave后第二房WAITING普通UNEQUIP保拥有库存；同伴单击后至少3500ms无恢复。每房比较共同完整快照，四Leave后在房外普通EQUIPslot1重装同一购买实例，最终state2供UI3650使用，不重复购买。核双方完整QUERY/native资料与购买receipt，再断开、停止、同库启动认证并比较完整四QUERY。

准备输出为 `recovery/output/supply-healing-preparation.json`。driver成功字面状态为 `PASS_FINITE_ORDINARY_BUY_EQUIP17061_SUPPLY20_PERIOD3000_UNEQUIP_STOP_DUAL_STATE_NATIVE_RESTART_SCOPE`。compiled62894窗口下专属types1902 exit0，唯一first85387 actualexit0，已完成并清理，未重跑。

## 限定范围

周期、重置、不叠加与20优先为明确Web重建政策，原Func2/T999调度与原服务器时间写入仍未恢复。13171不进入currentSkills或属性被动选择器。普通两房网络验收覆盖装备恢复与卸下停止；满血推进、复活/来源改变重置等为root消费者工程范围，未称网络已验。父项保持开放。


## 普通联机有限结果

原始结果 `recovery/output/supply-healing-network-2026-10-05T23-53-12-130Z.json`，汇总 `recovery/output/supply-healing-network-analysis.json`。正常BUY17061扣1500取得实例12，WAITING本人Ready后普通EQUIPslot1取消Ready。第一房自然critical伤害195.84954628635109，HP700→504→524→544，两次20恢复的间隔为模拟3秒、服务器3015ms、墙钟3009ms，181个共同完整快照相等。第二房普通UNEQUIP后自然normal伤害97.92477314317554，HP700→602，模拟3.5秒、服务器3521ms、墙钟3508ms无恢复，164个共同完整快照相等。

四次普通Leave后房外重装同实例12，最终slot1/state2/ownedQuantity1/coldBattleQuantity0，保存供UI3650使用。双方完整profile/inventory/owned及新shop receipt已由driver核原生保存，实际同一路径stop/start后双方四QUERY全文等。finally保存204800B checkpoint与0600私密身份，临时库删除、服务停止且3649亲空。网络独立主审 `recovery/output/supply-healing-network-root-review.json` / `PASS_FINITE_ORDINARY_BUY_EQUIP17061_SUPPLY20_PERIOD3000_UNEQUIP_STOP_DUAL_STATE_NATIVE_RESTART_SCOPE` 已接受上述有限范围；页面与合审有限范围如下，父项仍保留。


## 页面与合审有限结果

合审 `recovery/output/supply-healing-root-review.json` / `PASS_FINITE_ORDINARY_BUY_EQUIP17061_PERIODIC20_UNEQUIP_STOP_BENEFIT_DUAL_STATE_NATIVE_RESTART_SUMMARY_CLOSE_SCOPE`，页面独立主审 `recovery/output/supply-part-browser-root-review.json` / `PASS_FINITE_EQUIPPED17061_NATIVE_INJURY_PERIODIC20_BENEFIT_CONSUMER_DUAL_STATE_SUMMARY_HOME_CLOSE_SCOPE`。原网络主审保持独立路径。

页面18000 actualexit0的新房正常键盘命中伤害97.92477314317554，HP700→602→622→642，两次20间隔3030ms；493个共同完整快照相等，Benefit实际glyphmesh16/12、Scene帧8/6，两次正常Leave/StrictHomeClose及draw/context清空均已收。完整原生保存208896B/私密0600，来源与新room范围独立记录。首27353原FAIL及其已达Home/周期来源保持，不称该首运行整体PASS。页面没有新交易、额外效果或周期wiretimer；网络同库重启仍由85387独立证据承担。
