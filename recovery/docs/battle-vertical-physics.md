# 垂直物理：NAV 高度、重力与地面接触

## 原始来源边界

保存的原反汇编与原执行证据只覆盖水平运动：`0x433190` 校验非正 delta、截上限 1，调用 `0x435088` 后调用 `0x433073` 重建水平 OBB 矩阵；`0x433073` 由 `forward.z` 与 `forward.x` 符号求 Y 轴角，写旋转矩阵加位置平移，保留 49×24×52 尺寸。两个入口都没有 Y 积分、重力、落脚高度、下落限速或地面接触步骤。`0x426b92` 是出生重叠的水平分离，不是垂直解算。证据见 `role-movement-dispatch.md`、`role-movement-obb-prediction.md`、`role-movement-separation.md` 与 `recovery/evidence/movement/`，本轮未重跑 native。

因此下列垂直规则是**明确的项目采用规则**，不是原算法等价实现。重力常量、落脚限高、贴地容差与下落限速都没有原始依据，按当前单位与数据取合理值，可独立调整。

## 采用规则

垂直与水平向量分离：水平和 `forward.y === 0` 的严格采样规则不变，垂直只作用于位置的 Y。共享模块 `apps/shared/movement/tank-vertical.ts`：

- 高度来源为 `NavigationGrid.sample(x, z)` 的原 NAV 单元高度；无单元或无效单元时不改 Y。
- 重力 `600`、最大下落速度 `900`，单位沿用源世界单位每秒，`dt` 即水平核已用的秒值（`roleMovementElapsed` 上限 f32 .2）。
- 贴地容差 `0.5`：地面附近且垂直速度非正时直接落脚并清零垂直速度。
- 落脚限高 `18`：地面静止车体走向高度差超过限高的候选被拒绝，X/Z 保持原格，垂直轴不上升。
- 高于采样面时按重力积分下落，落到采样面即接地；离地期间 `airborne=true`。

水平候选先经原水平核与 `constrainTankPose` 得到 X/Z，再在最终 X/Z 上做一次垂直步，保证坡面不会缩短水平扫掠。碰撞被拒（水平未动）时仍执行同一次垂直步，使静止与受阻挡期间也能下落并接触地面。

## 两端接线

- 服务端权威：`battle/movement.ts` 的 `predictBattleMovement` 在所有分支（静止、被拒、原地转向、推进）推进垂直；`dynamic-movement.ts` 在其它坦克约束后的 X/Z 上做唯一权威垂直步；`commitBattleMovement` 写回 `verticalState`。
- 服务端 CPU/自动：`actors.ts` 经 `predictControlledBattleMovement` 走同一权威垂直步；无恢复运动参数的回退分支先在最终 X/Z 上生成水平候选，再把 `battlefield.move` 写入的采样 NAV 高度还原为步前物理 Y，最后共享同一次垂直积分，只由垂直步决定下落，不把已落地候选当作步前 Y。
- 水平许可边界：水平移动许可只约束水平候选。静止、许可/碰撞拒绝时水平保持原格，但仍在最终 X/Z 上执行同一次垂直步推进重力；被拒绝不冻结下落。
- 浏览器手动：`web/src/match/local-tank-motion.ts` 用共享垂直步推进本机位置，姿态照旧整帧经 `PlayerInput.pose` 上报，服务端手动分支不二次推进。
- 生命周期：`start.ts`、`life.ts` 在开局、复活、再战与从自动驾驶恢复手动时把垂直状态清为落地/离地初值。
- 托管切换：正式的 `World.configureAutopilot`→`configureBattleAutopilot` 与断线释放 `World.pauseDisconnectedPlayer` 在控制权实际改变时，按当前 Y 与真实 NAV 重建 `verticalState`，两种方向（手动→托管、托管→手动）都清掉旧下落速度与空中标志。

## 生命周期与协议

出生、复活、再战、托管切换都重置垂直状态，不保留旧速度。协议无需新增字段：`ClientTankPose` 已有 x/y/z，`MsgRoomSnapshot` 已有 y，位置链路足够承载垂直结果。本轮未改 `MsgPlayerInput`、`MsgRoomSnapshot`、`serviceProto.ts`。

## 未加入

不加入跳跃输入、掉落伤害或未知垂直机制。视觉车体 pitch/roll 仍是渲染姿态，不冒充物理，也不回灌水平核或命中 authority。

## 未实测

本轮仅做源码静态接线与既有反汇编阅读，未运行测试、构建、类型检查、浏览器验收或 native 实验。原重力量级、原落脚限高、真实斜坡上的连续性、极陡边与多格落差仍待原始来源或独立实测。
