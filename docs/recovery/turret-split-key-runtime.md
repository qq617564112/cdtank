# 分离键位炮塔转向

左右方向键控制炮塔，A/D控制车体。正式`advanceBattleTurret`在普通车体运动提交后处理炮塔输入，复用原`0x4340fd`对应的command3/4数学与`0x435088`导航提交规则。

- 炮塔转速读取实际角色合成turn，来源为坦克、有效宠物精通、已生效技能/装备、原限制与f32转换。来源不完整时保留既有`TankTurn×.12`原型速率。
- TankType1–3先旋转look；沿原方向分支超过约π/2后forward跟随。TankType4直接令forward等于旋转后的look。
- 车体跟随转动使用现有原角色转向许可、NAV和动态OBB门禁。未改变forward的独立瞄准保留现有许可语义。
- 跟随时移动参考方向同步旋转，aim重新表示炮塔绝对朝向与移动参考角之差；快照显示与发射继续共同使用`yaw+aim`。
- aim为0或elapsed非正时不更新炮塔/车体方向。按键抬起立即发送当前输入，失焦立即发送中性输入；本机手动角色直接显示最新权威姿态，停止后不再追赶插值目标。

原来源见`role-movement-directions.md`、`role-movement-dispatch.md`、`tank-movement-qualification.md`及`role-key-poll-source.md`。原方向键与WASD合并到同一组运动位；当前键位分离是明确的产品设定，原数学被复用于独立炮塔通道。

本次接线按源码集中走查；未新增或运行测试、浏览器验收、构建或类型检查。原指令向量沿用已有证据，不能据此宣称当前普通对局实测通过。
