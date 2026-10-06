# 反应装甲每生命一次抵消页面消费者准备

`tests/browser-reactive-armor-counter.mjs`预留3630/5660/9860，等待Numeric最终合法双账户checkpoint。普通Home→战车→原rdoEquip只读槽1的实拥item17071，实例动态读取；入房权威roleSkillSources确认其技能source13161。

普通双页map7/mode4 Create/Join/Ready后，peer通过原方向键及nativeSpace两次独立单发2001。每次Space保持至实际新增一发fire或最多250ms，finally释放，两次射击独立计数。首击双端hit.value0、守方HP保持；第二击伤害由Numeric最终参数明确提供，核守方整数HP及双端一致。每次均按roomId/round/phase/tick/serverTime核完整共享快照；每页网页roomId/round/phase/tick分别匹配该连接权威快照，并对players全文deepEqual。两次射击范围明确断言0playerHealed/0itemUsed。

peer PLAYING原出口Leave后，host自动FINISHED并以原summaryLeave退出，再双Home Close。PlayerInput、原键target/focus/world与退出DOM阶段仅观察，不注入状态，不增加counter wire字段或新FX。

入口：`node --import tsx tests/browser-reactive-armor-counter.mjs --fixture <final-identity.private.json> --database <final-checkpoint.sqlite> --expected-damage <Numeric-final-second-hit-damage>`。服务使用`scripts/start-server.mjs`，不覆盖MATCH_TIME或MIN。

最终主审：`recovery/output/reactive-armor-counter-root-review.json`，状态`PASS_FINITE_PURCHASED_EQUIPPED_REACTIVE_ARMOR17071_PER_LIFE_FIRST_BLOCK_SECOND_DAMAGE_READY_DUAL_STATE_NATIVE_RESTART_KEYBOARD_SUMMARY_CLOSE_SCOPE`；浏览器主审：`recovery/output/reactive-armor-counter-browser-root-review.json`，状态`PASS_FINITE_EQUIPPED17071_NATIVE_TWO_SHOTS_ZERO_THEN_DAMAGE_DUAL_STATE_NATIVE_SUMMARY_HOME_CLOSE_SCOPE`。主审确认原生完整profile、owned、inventory及receipt。网络同库重启为独立session96406范围；World session3854模拟覆盖10blocks、177damagehits与2ownerrespawns，与本浏览器单生命两击范围分别登记。

## 限制

实际唯一first已完成，证据汇总`recovery/output/reactive-armor-counter-browser-accepted.json`；raw `recovery/output/browser-reactive-armor-counter-2026-10-05T22-33-06-266Z.json`，session40929实际exit0。实拥实例10/source13161，首击0且HP650保持，次击93.78881977161026且HP556。两次共享快照及每页同tick权威players全文一致、双Close通过、0Runtime异常/0heal/item；四项清理完成，亲核三端口为空。本次页面仅覆盖单生命额度1的前两次命中，start/respawn规则由root与独立网络范围确认。没有新增BUY、EQUIP、资金、Point、CPU、截图、重启、维修、出售或旧效果矩阵；整页视觉父范围独立保留。
