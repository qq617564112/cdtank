# M4-10-I501 1UP

源物件501/技能501写明我方坦克存量+1，battleUseMax2；技能首函数Type18、x1/y1，首效果Effect12/SE13、Tag0、Method3。现存表足以确认预期功能和表现绑定，不能证明失去的服务端处理与资格。

本片仅使用已经明确归属账户的库存。原表金币/星币价0不表示服务器授予免费购买权限，正式商店保持原已恢复范围，不提供501购买或赠送。测试初始归属作为显式fixture，禁止写入战斗生命、位置、存量或胜负。

重建资格：仅进行中的mode1、活角色status2、本队0/1且两队存量为正整数、库存与本局数量非零。成功只增本队1，先保存数量CAS，再修改房间存量与实时数量；失败不动房间状态或库存。该即时作用无需创建技能槽或持续状态，不影响HP、攻击、防御或敌队存量。重复input.sequence沿既有门禁；再战重新使用源地图存量，有限库存不补发。本队资格、原Type18业务解释和成功消费均明确为重建规则。

正式模块归battle/items/team-life，accept-input只把普通请求分派给模块，World传入窄房间上下文。既有RoomSnapshot.match.teamLives、BattleMatch模式说明与原通知消费者投影状态/Effect12/SE13，无需新协议或另造UI。效果精度由专项和实际网页验证，不以通知存在替代实绘播放。Effect12内置ww051原文件缺失，沿既有原loader缺失静默/完成true/stop直接返回合同；音频内容仍为M4-08/M4-11缺口，禁止代用声音。

验收失败假设：非法模式/保存失败仍增存量或扣量；重复按键重复作用；对队被改；再战把已耗库存补回；只一端收到状态；资源只创建未绘制或声音未播放；真正重启丢库存和槽位。对应修复仅落在本模块/普通输入、现有运输、资源或账户链路，不扩大原取证。

## 已完成的集成证据

`team-life.cts`成功/拒绝/保存原子专项PASS；`team-life-world.json`普通CPU自然mode1两局每局存量[30,30]→[31,30]、随后47/46真实击毁与逐次生命扣减，账户3→2→1及库重开保持；`team-life-network.json`真实3182两账户同事件/同tick、非mode1/重复/空归属不作用、501商城排除及购买拒绝、实际服务器重启恢复PASS。Effect12专项11节点/8draw/实时挂点/SE13单次选择与释放PASS，内置ww051源缺失边界保留。

最终全仓类型与259个正式模块依赖边界PASS；服务端独立构建PASS，发行accept-input真实引用team-life模块。必要日志为team-life-types.log、team-life-boundaries.log、team-life-build-server.log。Web运行代码、资源、协议、通用伤害/回合和原账户保存流程没有修改；M5-02-F既有五模式CPU两局/账户保存/两端发行及资源基线复用，本片只补受影响mode1两局和501真实保存重启，不重复全套广泛回归。browser-team-life.json最终正常双网页严格PASS：两页tick66本队30→31、对队30保持，双方实际Effect12绘制与SE13playing/ended、repeat只发一次、真正服务重启库存2/slot4、mode4源HUD拒绝不消费及全部资源/专用进程清理。完整命令test:combat:team-life及:browser。
