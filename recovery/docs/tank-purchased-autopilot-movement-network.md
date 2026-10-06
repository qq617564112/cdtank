# M2-03 正式取得角色本人托管运动消费者

四Account起始零拥有/库存，仅profile资金100000为显式测试夹具；真实TankShop BUY3/PetShop BUY2、SelectRole生成所选来源。正式`actors.ts`从`originalMovementParameters`把独立recoveredMovement的speed/turn、原navigation和动态预测交给同一BotController，托管通过正常authority输入执行，没有改位置、生命、伤害或事件。

本片复用原TankMove/TankTurn、实际精通/+34条件与技能选择/限幅/f32来源，统一参数speed130、turn0.6806783676147461。原购入+34=0及服务端取得政策仍重建，宠物拥有不当boundGear；AI路线、目标选择和本人托管为当前重建业务，不称原CPU配置或原AI算法。

## 有效实际数值

`tank-purchased-dynamic-movement-network-2026-10-04T18-34-35-155Z.json`为原mode2/map2合法四人占领房，普通Autopilot开启后160tick观察，整体FAIL保留。相同raw的`-analysis.json`限定PASS_LIMITED_PURCHASED_AI_NUMERIC_SCOPE：31相邻存活移动步为6.492226120522921～6.502491830060229单位，符合speed130×.05秒，公开位置量化容差.03单位；34静止车体转向步为.0340/.0341rad，符合turn×.05秒，角容差.001rad。161共同PLAYING tick全players双端一致。

行进时车体forward追随原434241 align允许2a/3a，不能把所有bodyYaw变化都当静止转向公式。该raw原断言误把行进姿态纳入静止turn范围，未执行关闭与Leave；分析仅接受上述数值，未把原整体FAIL改为PASS或宣称完整退出。

## 首次关闭与正常退出

`node --import tsx tests/tank-purchased-dynamic-movement-network.cts --autopilot-exit-only`只补未执行动作。`tank-purchased-dynamic-movement-network-2026-10-04T18-36-25-566Z.json`为PASS_PURCHASED_AUTOPILOT_EXIT：合法mode2/map2真实取得来源→Autopilot开启确认→10tick后关闭→fresh正常stop输入→tick14–19无托管、位置/车体方向稳定。19共同PLAYING tick全players一致、4正常Leave，服务/tmp清理。移动与完整转向段未复跑。

模拟tick50ms、serverTime及接收wallTime各自保存在实际相邻步记录中。本组合只证明正常BUY来源进入本人AI运动消费者与关闭接管，不代表全部车型/配装、原AI或完整原碰撞。专属strict类型检查exit0见`tank-purchased-autopilot-movement-types-exit.log`。

来源不足/拒绝记录保留：18-31-45-066Z破坏房120tick有转向和4fire但无位移，不能证明移速；18-33-18-127Z错误mode2/map7被CreateRoom拒绝，未进入PLAYING。原MAPS支持mode2的2/5/6/10/11，修正实际使用map2。M2-03原位登记由主线审查，不关闭父项。
