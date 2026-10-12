# 特殊弹 Web 轨迹展示

`apps/web/src/render/battle-projectiles.ts`是特殊弹药连续弹丸的 Web 只读展示消费者。它直接消费`MsgRoomSnapshot.bullets`的实际`id/x/y/z/vx/vy/vz`，不修改权威坐标、伤害或碰撞，也不新增协议字段。

## 采用来源

服务端特殊弹连续轨迹及`BulletSnapshot`的现有采用合同见[battle-non-ui-shots.md](battle-non-ui-shots.md)。原客户端独立飞行实体的创建、更新和原外观资源仍未取得，见[projectile-visual.md](projectile-visual.md)；本消费者不声称恢复原弹丸外观。

本批按项目采用规则统一显示为金色小型自发光本体和短尾迹。本体颜色沿用现有战斗标记采用值`Color3(1, 0.85, 0.15)`，尾迹使用同色系半透明短柱。`BulletSnapshot`没有`ammoItemId`，因此不按特殊弹种类切换外观；玩家选择普通2001时服务端不写入 bullet，本消费者也不会由玩家弹药字段补造实体。

## 运行接口

| 接口 | 合同 |
| --- | --- |
| `constructor(scene)` | 创建本模块拥有的两个共享`StandardMaterial`并注册场景销毁清理。 |
| `reconcile(snapshot)` | 以`id`增删实体；scope 为`roomId`与`match.round`，任一变化或`phase !== 'PLAYING'`时清场。权威中不再存在的实体立即释放网格。 |
| `render(nowServerMs)` | 从最新快照的位置和速度推演，时间差限制在`0–100ms`；Web 将 Babylon X 映射为`-native X`。 |
| `clear()` | 释放全部弹丸网格并重置 scope/time，保留共享根材质，模块可在同一实例继续复用。 |
| `dispose()` | 先执行`clear()`，随后释放两个共享根材质；重复调用无额外效果。 |

本体网格和尾迹网格在实体创建时各创建一次，所有实体共享模块根材质。尾迹按最新速度方向即时定向并放在本体后方，不保存历史轨迹点，因此同一`id`跨重生不会连接旧位置。速度为0时隐藏尾迹，但保留本体。

## 接线边界

root在 Battle 实际接入时负责创建、按战斗快照调用`reconcile`、在渲染帧调用`render`、断线/离场调用`clear`，以及最终场景生命周期中的`dispose`。本模块不持有网络连接状态，不自行判断断线，不创建普通2001实体，也不接入炮口动作、命中效果或伤害规则。

以上为静态实现说明，未运行测试、浏览器、构建、类型检查、lint或原生取证。
