# Func21 战术雷达可见性

## 来源与采用范围

skill13111 是 `Trigger0/Target1/Func21`、X0/Y1 的被动干扰来源；skill13112 是
`Trigger0/Target1/Func21`、X1/Y0 的被动探测来源。两者 Effect/Sound 和 RadarA/B/C
均不参与本实现。`readRadarModifiers` 只检查
`PlayerSnapshot.roleSkillSources.selectedSkillIds` 是否包含 13111/13112，不读取全局技能目录，
不新增快照字段或协议字段。

`canObserveRadarMarker` 是战术 marker 关系谓词：本人始终可见；mode 1–3 同队目标不受雷达限制；
mode 4/5 的其他参与者按敌对处理。只有敌目标的 `jammer` 为真时，观察者才需要自己的 `detector`；
没有敌目标干扰、同队或本人 marker 不受 detector 限制。该谓词不包含生存和光学隐身判断，
也不改变世界模型、CPU 目标选择、伤害、碰撞或 actor 绘制。

光学隐身继续由 `isHiddenByOpticalCamouflage` 独立过滤。雷达 detector 不能解除光学隐身，
雷达 jammer 也不能替代光学隐身判断。

## 当前消费者

正式消费者是 `apps/web/src/render/battle-minimap-renderer.ts` 的 tactical marker 循环。
每个 player marker 继续先执行原有的非本人死亡和光学隐身过滤，再调用
`canObserveRadarMarker(local, player, snapshot.mode)`。本人死亡 marker 仍由原 LOCAL 分支绘制灰色；
友方/敌方/VIP 颜色、屏幕 quad、UV、朝向、宽度缩放、actor pose 插值和队伍映射不变。

## 来源缺口与验证边界

13111/13112 的合法取得入口尚未恢复：已知 item、pet 和 `PetSkill` 没有引用，原 part 表也未冻结。
因此没有真实 `selectedSkillIds` 来源时两个被动效果不生效，不从 13113 或其它雷达部件映射 grant。
共享谓词和最小地图消费者尚未在真实 mode 4/5 干扰/探测组合中实测。
