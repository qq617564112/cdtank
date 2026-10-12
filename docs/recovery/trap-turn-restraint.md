# 果酱3004转向许可规则

FUNC-04/FUNC-12/M2-03。独立模块 `apps/server/src/battle/items/trap-turn-restraint.ts`，纯规则验收 `tests/trap-turn-restraint-rules.cts`。主线负责ground对象、库存CAS、Shop、PlayerState、protocol、World与事件生命周期接线；本模块只消费turn许可provider，不接触CombatState内部或HP/技能槽。

原表与来源映射 `trap-turn-restraint-source.json`：item3004→skill3004 Func12(T30/X30/Y4002/Z3004)→skill4002 Func4(T5)。原loader43aee9–43af57写三槽+158/+164/+170/+17c/+188；432f91的command3/4读取flag10，混合command5–8读取flag9与10。原flag10位于record+126；观察者42f6ed–42f74d对比role+36a，HP getter15正且新count0或旧count=new+1时调用4886aa/4002/duration0。既有原observer和运动许可执行证据复用，无native重跑。

明确重建：T30作为30服务秒地面存活，X30作为XZ原世界坐标半径，Z3004作为模型；T5作为5服务秒束缚。apply仅存活/status2/无现state且当前count>0时减1写uint8，保存removedTurnPermission1；不叠加或刷新。expire在now>=expiresAt时恢复当前count+本trap贡献并截uint8，不覆盖其它来源变化。clear可提前作相同恢复；死亡、失活、丢失count来源或round reset删state不恢复，由源生命初始化许可。

稳定接口：`TrapTurnRestraintState`含itemTableId3004、skillId4002、expiresAt、removedTurnPermission1；participant属性为trapTurnRestraint，provider为readTurnPermissionCount/writeTurnPermissionCount。readTrapTurnRestraintRule与apply/expire/reset/clearTrapTurnRestraint返回实际change kind、turnPermissionChanged、turnPermissionCount。

12新pure条件PASS_MODULE_ONLY：转向count1→0时直行前后仍允许，车体与混合运动拒绝；5000ms准确期限、不刷新、提前清除/当前count变化与255环回、重复不写、失活/缺源reset及HP655/正skill6/直行count保留。规则证据不等于真实取得或双端业务。原Func12/4计数写入地址、期限时钟消费者仍未找到，下一入口为3004地面触发→4002dispatcher与属性33数组10发送者；不把现重建provider写入称为原producer。

普通网络首次实际已通过，索引 `trap-turn-restraint-player-evidence.json`，主线审查后按原位登记。复用合法BUY3/pet2 checkpoint，真实BUY3004×2/slot1→普通敌方进入→直行保留、A/D受限、Arrow独立、自然5秒恢复→双状态/事件、有限库存与正常Leave。无活跃position/flags注入，不替代全部陷阱、原函数语义、图声或完整父项。

实际raw `tank-purchased-trap-turn-network-2026-10-05T03-13-11-335Z.json`：count1→0，前进/倒退各0.25模拟秒移动32.50404、速度130.01618，server分别0.251/0.252秒、墙钟0.250/0.249秒；车体和组合输入0距离0转角，独立炮塔0.25秒转0.1702rad并普通2001开火。HP保持，tick50–149束缚存在、tick150首次过期，权威期限5000ms，首次可用服务tick迟20ms；恢复车体0.25秒转0.1702rad，与实际源0.68067837rad/sec一致。157共同tick完整players/ground一致，7完整事件同序，双round1正常Leave。库存3004余1、slot1指向真实新实例；正常停服务后已保存0600原生SQLite备份和私有identity供主线独立持久终点，不冒已实际重启。

扫光光selector仅新增支持当前有效3004，半径/过期/返回引用政策不变；新 `trap-sweep-jam-rules.json` 覆盖3004的边界、外侧、到期及Y忽略，不复跑旧3003。原地面对象被扫除和果酱已有束缚互不替代，正式消费者由主线接线。

主线已亲审本普通网络有限通过，组合索引 `trap3004-business-accepted.json`。主线独立复用本run原生备份实际停启编译服务器，`trap3004-restart-2026-10-05T03-15-11-870Z.json`核同身份、完整库存/槽与余额93960恢复；没有重跑控制主段。原115表现由FX专属首次验收接续，完整原producer/陷阱父项保持开放。
