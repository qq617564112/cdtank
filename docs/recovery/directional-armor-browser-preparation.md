# 侧背装甲页面消费者准备

`tests/browser-directional-armor.mjs`预留3632/5662/9862，等待Numeric最终合法双账户checkpoint；17071已普通卸下且保有，页面不重复装备或取得。双页普通map7/mode4 Create/Join/Ready后，host以原KeyA/KeyD调整车体，peer以原Arrow瞄准、每方向独立nativeSpace唯一2001射击。

每次记录真实target.bodyYaw与target到peer的bearing，归一相对角：绝对值≤45度front、≥135度back，其余side。输入对齐目标分别取0/90/180度中心。三种hit伤害必须Numeric最终参数明确提供，核每次双端hit与整数HP变化、完整同key共享快照、各页同连接同tick权威players全文一致。两次射击间释放所有原键，不注入方向或HP。

peer PLAYING原出口Leave，host FINISHED原summaryLeave，再双Home Close。键盘target/focus/world、PlayerInput及退出DOM阶段只观察；0playerHealed/0itemUsed。

入口：`node --import tsx tests/browser-directional-armor.mjs --fixture <final-identity.private.json> --database <final-checkpoint.sqlite> --expected-front-damage <Numeric-front> --expected-side-damage <Numeric-side> --expected-back-damage <Numeric-back>`。使用`scripts/start-server.mjs`，不覆盖MATCH_TIME或MIN。

最终主审：`recovery/output/shot-defense-facets-root-review.json`，状态`PASS_FINITE_QUALIFIED_SIDE_BACK_ARMOR_NORMAL_BODY_TURN_THREE_HITS_DUAL_STATE_NATIVE_RESTART_KEYBOARD_SUMMARY_CLOSE_SCOPE`；浏览器主审：`recovery/output/directional-armor-browser-root-review.json`，状态`PASS_FINITE_NATIVE_BODY_TURN_FRONT_SIDE_BACK_THREE_2001_HITS_DUAL_STATE_NATIVE_SUMMARY_HOME_CLOSE_SCOPE`。主审确认原生完整资料与各页同tick players。网络99422的三击来源与原生证据、onlycold94217的同库重启、World72416的143hits及1respawn模拟分别登记；本浏览器覆盖三次原输入命中与summary/Home Close。

## 限制

唯一first实际通过，证据汇总`recovery/output/directional-armor-browser-accepted.json`；raw `recovery/output/browser-directional-armor-2026-10-05T22-49-35-578Z.json`，session90597实际exit0。原A/D真实bodyYaw及bearing确认front/side/back，HP650→556→450→334；各完整共享快照与每页同tick权威players全文一致、双StrictClose通过。Runtime异常0，四项清理完成，亲核三端口为空，最终真实checkpoint已保存。方向阈值与最终伤害属Web policy，source ratios资格由主线独立审阅。没有新增BUY、EQUIP、资金、Point、CPU、截图、重启、新FX或旧hurt/native/draw矩阵，不安装10821 Trigger2；完整视觉父范围独立保留。

Numeric三方向实际参数已提供：front93.78881977161026、side105.8163984842481、back115.70881218126303，普通HP序列650→556→450→334。命令伤害参数为`--expected-front-damage 93.78881977161026 --expected-side-damage 105.8163984842481 --expected-back-damage 115.70881218126303`。compiled28620冻结；最终checkpoint/private等待cold持久化尾段与root审阅，页面尚未运行。
