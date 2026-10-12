# 回旋饮料真实购买后的托管转向

M2-03/I07取得到本人Autopilot转向消费者的首次支路由tests/tank-purchased-turn-drink-ai-network.cts验收。旧turn-drink-ai-network使用完整拥有与库存fixture。本片沿真实BUY3/pet2检查点，新Shop请求购买物件7一件、正常Kitbag槽4，合法mode2/map2四参与Ready后仅Autopilot API开启自主输入，客户端PlayerInput0。

AI沿既有turnDrinkHotkey/finishItems普通useItem5自主使用一次，库存1→0。原skill7 ItemTurn+6进入统一limits/mastery/f32运动计算，实际拥有来源输出基线0.680678368→1.099557400 rad/s，速度130保持；无新控制器、优先级、转向倍率或共享政策改动。

活跃且存活的12个连续原地转向步，每步50ms、位移0，归一化车体角增−0.0549或−0.0550，与原转速×0.05一致（快照角舍入容差0.001）。累计−0.6598rad/0.6模拟秒。此处独立测静止转向，不以移动转向的既有倍率充当新原地规则；服务/墙钟每步数据保存在raw与封装。

disable后至少五份连续快照的坐标、yaw/bodyYaw/aim均保持，23次共同完整players观察及指定itemUsed7双同，四正常round1 Leave成功。3327无监听、服务进程/临时库清理完成。

原raw tank-purchased-turn-drink-ai-network-2026-10-05T04-43-04-663Z.json与同前缀-server.log；封装tank-purchased-turn-drink-ai-player-evidence.json。真实BUY6/7手动作用及自然恢复、旧AI绘声/两局/重启合同复用，不重跑。购买+34初值、AI策略和控制映射仍按既有明示重建边界；宠物拥有不作boundGear。完整M2/I07父保持未完成。
