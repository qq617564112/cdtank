# 原运动参数消费者

原426a54命令处理进入433190，经角色virtual+10 selector10/11读取重算后的record+48/+4c，再传入435088(position/look/forward/command/tankType/move/turn/delta/matrix/turnCenter/world)，经434cee碰撞包装与4344e7实际推进。getter4321e3的432210/432220分别读取两字段。

完整4344e7的前进/倒退路径中434565使用move×delta，命令1/2分别按look向量正负推进X/Z（早期同向样本无法区分两向量；新增分离方向样本已纠正解释），没有额外倒退速度系数。原执行type4、move30/turn0.5、delta0.05/0.2，从[10,0,20]前进至[11.5/16,0,20]，倒退至[8.5/4,0,20]。完整432013读取move/turn构造命令5–8中心，半径最小80；30/0.5=60仍取80，中心为[10,0,100]或[10,0,-60]。

命令3–8的弧线转弯包含forward/look对齐与TankType分支。435088最大delta截到f32 0.2，433190最大截1且非正数提前返回；仅这些静态分支不证明上游时钟单位或全部碰撞行为，不能直接把actors的yaw比例替换为原turn。

验证：recovery/.venv/bin/python recovery/evidence/movement/role-movement-consumer-native.py；movement-consumer-native.log、movement-consumer-audit.json及movement-consumer-audit.disasm.txt。8个原入口执行样本断言位置/方向/转弯中心与返回位置；41d98e分量clamp由夹具供应，碰撞wrapper、上游delta时钟与各命令完整转弯未执行。新增144组完整命令/四TankType/分离方向数学对照见role-movement-commands.md，64组输入与6组时间生产对照见role-movement-input-clock.md；下一先补435088/434cee碰撞回退与controller许可，再按原dt/转弯/碰撞合同接正式World运动。
