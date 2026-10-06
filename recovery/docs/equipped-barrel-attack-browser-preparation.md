# 实拥炮管攻击页面消费者

普通Home→战车→原rdoEquip确认Equipment槽0的实拥13001实例8，原装备栏显示“生锈的强力炮管”。双页普通map7/mode4房间Ready后，以原Arrow输入瞄准并单次Space发射2001；两端权威hit均为196，同roomId/round/phase/tick/serverTime完整共享快照一致。

普通BUY/EQUIP、baseline176与boost196、保存及同库重启来自Numeric独立网络范围。页面消费者只读取其合法最终双账户checkpoint，伤害196由该正式结果明确提供，公式属于Web重建。

退出端点覆盖普通新房双Join/Ready、零开火：peer从PLAYING原出口Leave，host自动FINISHED后从原data-summary-leave退出，再两端普通Home Close。firstClosure与tailClosure独立登记；该新房闭合不称恢复首房，伤害事件及共享状态直接引用首实际。

最终combined主审：`recovery/output/permanent-barrel-attack-root-review.json`，状态`PASS_FINITE_PURCHASED_BARREL13001_QUALIFIED_ATTACK176_196_READY_DUAL_STATE_NATIVE_RESTART_KEYBOARD_SUMMARY_CLOSE_SCOPE`；浏览器主审：`recovery/output/equipped-barrel-attack-browser-root-review.json`，状态`PASS_FINITE_OWNED_BARREL13001_NATIVE_AIM_SINGLE_HIT196_DUAL_STATE_SUMMARY_EXIT_HOME_CLOSE_SCOPE`。

证据汇总：`recovery/output/equipped-barrel-attack-browser-accepted.json`。伤害raw：`recovery/output/browser-equipped-barrel-attack-2026-10-05T21-40-22-580Z.json`；退出raw：`recovery/output/browser-equipped-barrel-attack-2026-10-05T21-46-35-968Z.json`，session35091实际exit0。各Leave/HomeClose具名DOM阶段全部通过，两Leave分别确认PLAYING与FINISHED原出口，运行无Runtime异常。Chrome、server、Vite及临时目录全部清理，亲核3624/5654/9854端口为空。

## 限制

原server最终伤害公式与整页视觉父范围独立保留。页面没有新增BUY、EQUIP、资金、Point、截图、CPU、重启、维修或出售；退出端点没有重复瞄准或开火，原FX/布局证据独立复用。
