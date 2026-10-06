# Pet2 10211 击毁恢复 Web政策

M4-10/FUNC-02/Trigger4。原10211为Pet2槽0技能，Info击破敌方生命+40，Trigger4/Target1/Func2 T0、HP40；普通LEARN首级消耗10点。玩家沿既有peer拥有Pet2 instance3（slot0 rank0、slot1 10221 rank1）普通Select、LEARN槽0，不新增宠物交易；预服务Point10必须声明为非earned，资金、owned、rank及活跃战斗状态不注入。

采用统一最终敌对击毁时恢复的Web规则：攻击者仍在房、alive/status2且attributesReady，所选拥有Pet2槽0 base10211/rank1，并由原10211字段确认Trigger4/Target1/Func2 HP40才合格。self和mode≤3同team排除；HP0待死阶段不提前执行，10441到期的最终死亡进入同一commitPlayerDeath入口。射手离房、已死亡或技能未学不恢复。

由既有setBattleHealth整数生命入口恢复至min(maxHP,currentHP+40)，保留待死阶段正增生命拒绝。只以实际正生命差额发一次现playerHealed事件（skillId10211/playerId与targetId为本人），不因击毁回填弹药、装填或改变owned/profile。满生命或恢复被生命阶段拒绝时不发正恢复事件。原死亡/kill/模式结算仅一次，原终局清理继续执行。

root owns battle/pet-kill-heal.ts原资格及实际生命消费者、World最终击毁调用/工程验收；Numeric owns原字段合同和普通Select旧Pet2/LEARN10/未学与已学实际网络验收；UI owns正常Home所选来源/Ready学习取消和自然击毁后实际HP恢复文字、双端状态/退出验收。既有BattlePlayers.benefit与TankBenefitText接收真实生命差额，原10211独立效果sender仍待原字段与caller依据，不以通用恢复文字称原效果完成。

完成条件：合法原拥有Pet2普通Select与LEARN10→杀敌者先自然缺血至少40→普通敌对最终kill→一次实际+40/双端完整同键状态与网页各自tick/真实恢复文字→原双Leave/HomeClose、完整profile/owned/学习receipt及同DB重启查询相等。工程覆盖未学/无资格/friendly/self/满血夹取/待死拒绝及最终死亡唯一触发。正式pet-kill-heal.ts及World最终死亡已接，pet-kill-heal-engineering.json记录资格/满血夹取/待死拒绝和World延迟死亡唯一恢复；普通网络29196与双网页26940有限流程通过，见pet-kill-heal-network-root-review.json、pet-kill-heal-browser-root-review.json及pet-kill-heal-root-review.json；原Func2/Trigger4服务器调度和全范围父项仍开放。
