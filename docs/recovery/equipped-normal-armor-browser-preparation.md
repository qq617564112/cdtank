# 实拥普通装甲射击减伤页面消费者

accounts[0]为守方，普通Home→战车→原rdoEquip确认已选Tank3/Pet3及槽2实拥14003实例7。accounts[1]为射手；原装备确认由首实际证据提供。

普通新房map7/mode4双页Create/Join/Ready后，peer使用原Arrow方向键瞄准守方，Space保持到实际首fire并finally释放。实际保持96ms，正式PlayerInput sequence24/fire=true，仅一发2001。两端权威hit一致为87.48551647694896，守方整数HP562；同roomId、round、phase、tick、serverTime完整共享快照一致，网页状态同步记录。

peer从PLAYING原出口Leave，host自动FINISHED后使用原data-summary-leave退出，再两端普通Home Close。具名DOM阶段、两正式Leave回执及StrictClose均通过。运行无Runtime异常，Chrome、server、Vite与临时目录全部清理，亲核3626/5656/9856端口为空。

最终combined主审：`recovery/output/permanent-armor-root-review.json`，状态`PASS_FINITE_OWNED_ARMOR14003_QUALIFIED_SHOT_DEFENSE_READY_DUAL_STATE_NATIVE_RESTART_KEYBOARD_SUMMARY_CLOSE_SCOPE`；浏览器主审：`recovery/output/equipped-normal-armor-browser-root-review.json`，状态`PASS_FINITE_OWNED_ARMOR14003_NATIVE_PEER2001_SINGLE_HIT87_485516_HP562_DUAL_STATE_SUMMARY_EXIT_HOME_CLOSE_SCOPE`。主审确认两完整profile/inventory保持不变及原生持久化有限范围。

证据汇总：`recovery/output/equipped-normal-armor-browser-accepted.json`。装备来源：`recovery/output/browser-equipped-normal-armor-2026-10-05T21-58-46-035Z.json`；射击与退出：`recovery/output/browser-equipped-normal-armor-2026-10-05T22-03-51-616Z.json`，session57297实际exit0。只读记录原键盘down/up target、focus、world与正式PlayerInput，不注入游戏状态。

## 限制

Shot-only减伤公式属于Web重建，原server最终公式与完整视觉父范围独立保留。页面没有新增BUY、EQUIP、CPU、资金、Point、截图、重启、维修或出售，原效果矩阵独立复用。
