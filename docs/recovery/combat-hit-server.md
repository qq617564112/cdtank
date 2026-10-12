# 普通受击方向正式事件

M4-09-COMBAT-HIT 的普通成功命中通过 World→damagePlayer→RoomEvent 传递 hurtSelector。服务端使用原435745分类，输入为命中时受击角色和攻击角色的 look（原+274/+27c），由已有 battleMovementPose 保存的源方向或当前 yaw 生成。forward（+280/bodyYaw）、两角色位置、炮塔 aim 和弹丸速度均不作为该分类输入。

`roles/hurt-direction.ts`以原输入float32和x87 double中间值计算dot、CRT acos等价域内角度与cross。原float阈值为0.7853981852531433和2.356194496154785，分类0..3经原receiver转换为actor参数1..4，对应05..08。原dot>1分支角度为0；dot<-1的原CRT异常路径尚未恢复，Web明确省略该次选择，保持既有伤害，不fabricate默认动作。

正常World普通弹丸命中计算选择后调用现伤害门禁；队友伤害关闭或无敌拒绝不发hit，成功hit含selector。伤害、碰撞和复活仍为已有明确重建规则，受击分类本身不能证明全部原服务器行为。RoomEvent新增可选字段；未分类或旧专项调用保留省略，不默认0。TSRPC schema从协议生成，不手写codec。

`combat-hit-direction.cts`对照56个原完整函数向量，并核对原大于1分支及未恢复CRT域外边界；`friendly-fire.cts`保护成功/拒绝伤害门禁。正式双端普通输入与原资源绘制由本轮combat-hit实际验收提供，规则向量不能代替自然命中。
