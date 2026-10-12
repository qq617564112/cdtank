# 反应装甲攻击抵消

M2-01/M4-10/M6-01。普通17071的13161提供MaxCounter1，原整数role+58经过统一重算与DataScale20得到当前最大抵消次数。正式消费者仅在attributesReady时读取attributes.values.roleIntegers+58。

Web规则每条生命保存cancellationsSpent，当前可用次数为max(0,currentQualifiedMax-spent)。新参与者、普通开局/再开及复活重置0。装备来源、弹药或饮料重算不补已用额度，资格撤回期间不消耗，重新取得资格保留已用次数。

敌对非自身普通炮击先经过友伤与无敌门禁，再消耗抵消额度。抵消时目标生命不变，发布既有hit.value0；不给命中分，不触发生命吸收、烧伤或减速。医疗弹先行分派，周期伤害不走额度消费者。额度是瞬态战斗状态，与装备持久分钟数量无关。

原最大次数及技能来源有资格；剩余次数、重置、命中反馈与权威时序为Web重建。原remaining/reset/事件authority、完整父项保持开放。

## 实际范围

普通网络96406实际exit0：BUY17071花1500取得实例10/一分钟，Ready后EQUIPslot1取消双方Ready并重算integer58=1；peer两次2001首hit0/HP650/score0，次hit93.78881977161026/HP556并加2分，两发弹匣各消耗1，无生命恢复。45共同完整快照、两Leave、原生双profile/owned/inventory和购买receipt、双账户冷四QUERY同库真实重启一致。见reactive-armor-network-root-review.json。

World3854五模式各两局自然模拟：10次抵消、177次后续伤害、本人2次复活；每生命额度及再开重置、逐事件HP账与正常结束/Leave通过。VIP模式3资格不足撤回，不发布反应装甲资格。见shot-cancellation-modes.json及shot-cancellation-engineering.json。网页40929原生peer两次2001，首0/650、次93.78881977161026/556；sharedticks69/106及两页各自tick的players全文一致，PLAYING普通Leave与FINISHED summaryLeave、双HomeClose及原生全资料/购买receipt通过。最终主审见reactive-armor-counter-root-review.json。
