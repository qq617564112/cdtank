# Pet105 不怕痛与受击动作

正式 Web 门禁使用当前目标 attributesReady 合格的 roleFloat90。ammo 同 hit 的合格值 >=1 时不发布 hurtSelector；0或缺资格保持原 selector。该门禁保留伤害、整数 HP、score、critical、生命吸收、伤害文字与 Trigger8。周期伤害和医疗沿既有路径。

纯函数为 `roles/qualified-shot-hurt-resistance.ts` 的 `resolveQualifiedShotHurtSelector`。专属 `tests/qualified-shot-hurt-resistance.cts` 已通过，结果在 `recovery/output/qualified-shot-hurt-resistance.json`。authority 资格与 ammo 门禁由 root 的 `shot-hurt-resistance.ts` / `life.ts` 接线负责。

3635 普通网络驱动 `tests/shot-hurt-resistance-network.cts` 首次实际运行 exit0，最终专属 types exit0。使用 Critical 23-00-28 合法双账户保存库的副本，开服前只设本人 Point200，明确不证明赚取技能点；不增加资金或 owned。普通 BUY105 消耗5000 MONEY，显式 SelectRole，第一房 rank0 承受一次 peer2001 普通命中。第二房 host Ready 后普通 LEARN slot0 消耗200，双端 Ready 取消并加入11011，再普通命中一次。

每房按实际 owned、selected profile、current 技能与原表完整重算，独立核 roleFloat90 为0或1。原 peerPet2 的 critical 同 hit bool 决定 raw151或302，随后按当前目标防御及真实 front 来向计算浮点 damage，HP 按既有整数截断。两房各比较精确 room/round/phase/tick/serverTime 的双端完整快照，正常四 Leave 后读取完整资料。原生只读核两账户 profile、inventory、owned及新增购买/学习 receipt，随后实际停止并在同 database 路径启动，双认证与四 QUERY 全文相等。

实际两房各96个共同完整快照；未学 rate0 的 hit 带 selector1，已学 rate1 的 hit 不带 selector。两次实际 critical 都为 false，浮点 damage 同为97.92477314317554，整数HP同为700→602。四 Leave、两账户原生完整资料与两条新增 receipt、同库停止重启双账户四 QUERY 全文相等均通过。finally 保存192512B checkpoint、0600私密身份并删除临时库，3635已清空。

实际 raw 为 `recovery/output/shot-hurt-resistance-network-2026-10-05T23-18-45-702Z.json`，专属汇总为 `recovery/output/shot-hurt-resistance-network-analysis.json`。网络独立主审为 `recovery/output/shot-hurt-resistance-network-root-review.json`，状态 `PASS_FINITE_ORDINARY_BUY_PET105_LEARN11011_CURRENT_TARGET_HURT_SELECTOR_WITHDRAWAL_READY_DUAL_STATE_NATIVE_RESTART_SCOPE`。页面独立主审为 `recovery/output/pet-hit-resistance-browser-root-review.json`，状态 `PASS_FINITE_NATIVE_LEARNED_PET105_CRITICAL_HIT_HURT_ACTION_CALLS_ZERO_DAMAGE_TEXT_AMMO_RESULT_RETAINED_DUAL_STATE_SUMMARY_HOME_CLOSE_SCOPE`；combined 主审为 `recovery/output/shot-hurt-resistance-root-review.json`，状态 `PASS_FINITE_ORDINARY_PURCHASED_LEARNED_PET105_11011_CURRENT_TARGET_ANTI_HURT_ACTION_DAMAGE_TEXT_RESULT_DUAL_STATE_NATIVE_RESTART_SUMMARY_CLOSE_SCOPE`，网络范围独立保留。

3636 页面实际 session56800 exit0：正常 critical2001命中 damage195.84954628635109，HP700→504；同 hit 无 hurtSelector，两页 BattlePlayers.hurt/TankView.hurt 调用均0，而两页各一次 damageText 与普通2001结果消费正常。双端同 key 完整玩家和各页本 tick 状态一致，正常 phase Leave、summaryLeave、HomeClose、完整原生资料与购买学习 receipt 保持通过。该证据证明网页动作派发门禁与文字/结果保留，不宣称原 GPU 受击动画或像素等价。

## 限制

原11011 Info「钢筋铁骨，被打不会僵直啊。」与 DataScale22「硬直比例」足以确认受击抗僵直输入。原 BeStun 状态与原05..08受击动画、局部相机的等价调用关系仍未证明；省略本次 hurtSelector 是明确 Web 政策。该行为抑制新受击动作派发，不清除已经播放的动作或相机状态。全技能与原服务端僵直规则恢复仍开放。

完整来源见 [StunRate 合同](stun-rate-source-contract.md)，准备状态见 [prepared scope](../output/shot-hurt-resistance-consumer-preparation.json)。
