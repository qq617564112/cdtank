# 普通射击目标分派

正式普通开火现在区分坦克、场景与自由瞄准。坦克目标分支只保留射击动作及炮口声音，不生成目标点世界007/SE30。场景分支在原look乘查询距离加原位置后，以Y25显示007/SE30；自由瞄准继续在原1000单位端点显示。

## 原来源

`tests/combat-shot-target-native.py`实际执行完整4288fe及其距离/向量算术。436078和436fe0分别供给坦克目标、场景物件及场景距离，消息构造、快照与发送是供给边界。原431fe0/431fd2读取位置/look，41d7b1复制位置，423ff1/422d71执行平方长度与float32保存，CRT sqrt/fabs由数学接口供给。

同时存在两种目标时，原428a7a–428ac1计算目标角色中心到发射角色位置的距离（平方长度接近0/1时沿原0.0001容差返回0/1），与场景查询返回距离比较。坦克距离严格较小才走实体分支，等距及更远走场景分支。五份位置/方向、四组目标有无组合、十个距离共200向量由正式`roles/shot-target.ts`逐项对照，场景显示端点与自由瞄准端点逐float相等。证据为combat-shot-target-native.json/log、combat-shot-target.log。

原场景428b73分支沿422d4d将look与float32距离相乘，再逐float32加角色位置；显示时Y被覆盖为25。实际该分支发送3aa0，实体发送3a9d，自由瞄准发送3a9b。Web继续使用TSRPC fire事件与可选shotDisplay，不将原消息载荷声称为现服务端协议。

## 正式接线

`battle/shot-query.ts`供给现Web地图surface和活坦克球形查询，`roles/shot-target.ts`只负责原分派与端点算术。fire.targetId为被选择对象，自由瞄准为空；shotDisplay仅场景/自由瞄准存在。Battle沿已有源消费者显示，React无新增战斗状态。现服务端弹丸创建、速度、伤害、连续碰撞及玩法规则保持已有重建范围。

`tests/combat-shot-world.cts`验证普通PlayerInput开火、装填拒绝、端点float32、生成schema二进制往返，以及CPU/本人AI经普通输入自然进入目标分支。结果写combat-shot-target-world.json/log；之前自由瞄准限定证据combat-shot-world.json保留原范围。实际双网页消费者与资源绘声以browser-combat-nosphere证据为准。

## 未恢复范围

原436078/436fe0的目标查询几何未与Web建立等价性。当前查询沿既有弹丸高度20、坦克bodyRadius、地图surface及球体kernel供给，场景距离由现segment查询换算；这是明确的重建查询。原客户端最近角色选择、OBB与建筑破坏后的查询变化仍需恢复，不能由本分派向量证明完成。

原独立飞行消费者仍缺。正式无来源黄色球体已移除，服务器仍有权威弹丸用于重建规则；移除占位不证明原版没有弹丸动画，也不关闭M2-04。
