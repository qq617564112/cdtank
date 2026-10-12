# 速度饮料真实购买后的托管运动

M2-03/I06的真实取得到本人Autopilot运动资格支路首次由tests/tank-purchased-speed-drink-ai-network.cts验证。旧speed-drink-ai-network使用完整拥有及库存fixture；本片复用真实BUY3/pet2检查点，正常Shop购买物件6一件、Kitbag槽4，在原合法mode2/map2四参与房Ready后启用Autopilot。客户端PlayerInput为0，没有活跃生命、位置、标记或结果注入。

AI沿现有speedDrinkHotkey与finishItems普通useItem5自动使用一次，持久库存API回执1→0；技能6进入现统一运动合成。实际拥有+34/+58/+5c/+60来源明确，原坦克/宠物、skill6 ItemMove+6与原limits/mastery/f32尺度输出130→190单位/秒。宠物记录不充当boundGear；没有修改AI资格、优先级或运动策略。

在速度状态与存活条件均成立的12个连续50ms步中，位移分别在9.49345至9.50222之间，全部与190×0.05的9.5单位相符（快照坐标舍入容差0.03）。完整每步模拟、服务和接收墙钟时间保存于raw；仅比较实际移动步，不将AI对目标的等待或转向时间当作速度公式。关闭Autopilot后至少五份连续位置快照保持静止，不发送人工输入。

56次共同完整players观察双同，指定itemUsed6事件双同，四次正常round1 Leave成功。3326服务无监听、临时库与进程清理。原raw tank-purchased-speed-drink-ai-network-2026-10-05T04-40-50-261Z.json及同前缀-server.log；封装tank-purchased-speed-drink-ai-player-evidence.json。

此前BUY6/7手动作用与自然恢复直接引用tank-purchased-movement-drinks-player-evidence.json，旧绘声/两局/重启证据复用，不增加新验收声称。原AI策略、全部角色及M2完整父保持开放。
