# 五模式 World/timeLimit 运行时

本切片把 `mode-core-runtime.md` 的 `timeLimitOutcome` 接入 World 的真实终局链，并确认既有角色终局消费者。业务合同来自 `mode-client-business-design.md` 的 26 行源表与采用政策；本文把来源事实与项目采用政策分开记录。

## 已实现接口

`apps/server/src/world.ts`

- `World.step` 的房间自然时限分支改为调用 `timeLimitOutcome(room)`，把返回的 `ModeOutcome` 的 `winnerTeam`/`winnerPlayerId` 传给既有 `finishRoom(room, now, 'TIME_LIMIT', …)`。World 不再对 mode4/5 用团队 `score` 通用推导超时胜者。
- 房间 `mode`、`teamLives`、`teamScores`、`players` 直接满足 `ModeTimeLimitRoom`；`PlayerState` 提供 `id`/`team`/`vip`/`hp`/`kills`/`score`/`objectivesDestroyed`。
- `finishRoom` 的既有 `winnerTeam`/`winnerPlayerId` 参数由 `computeMatchResult` 原样采用（已定义值不再被重算），因此超时结果与提前终局共用同一条一次性冻结链。

## 超时比较语义

| 模式 | 比较顺序 | 平局 |
| --- | --- | --- |
| 1 | `teamLives` 高者 | `winnerTeam=-1`、`winnerPlayerId=''` |
| 2 | `teamScores` 高者 | 同上 |
| 3 | 双方王当前 HP；再队伍总击毁；再队伍战斗分 | 同上 |
| 4 | 个人击毁数；再战斗分，唯一第一取胜 | 完全相等平局，`winnerPlayerId=''` |
| 5 | 个人 `objectivesDestroyed`；再战斗分，唯一第一取胜 | 同上 |

个人模式（4/5）不按统一 `team=0` 判定胜者；`timeLimitOutcome` 返回 `winnerTeam=-1` 与真实 `winnerPlayerId`。

## 角色终局消费者

`apps/server/src/battle/life.ts` 与 `apps/server/src/modes/outcomes.ts` 的既有链确认与采用政策一致，本切片不改动：

- mode1 每方出击次数在开局取 `TankNum`（`modes/start.ts`）。非友方死亡经 `applyModeKill` 扣减受击方 `teamLives`；友方死亡经 `applyFriendlyKill` 同样扣减。次数归零立即 `OBJECTIVE`，对方队伍获胜。
- mode3 王由 `modes/start.ts` 每队稳定顺序首名有效玩家设为 `vip`，生命取 `VIPHPMax`（200）。王被任何有效伤害杀死（含开友伤时的友方伤害经 `applyFriendlyKill`）判对方队伍胜；王在 `PLAYING` 离场经 `forfeitOutcome` 判对方队伍胜；非王普通成员按既有 3 秒复活。
- 友伤走既有伤害/生命 policy。攻击者在友伤命中只加 `brokenScore`（负值），不增 `kills`、不计 `recordEnemyKill`、不加 `hitScore`/`destroyScore`；受害己方确死仍消耗其出击次数或破坏分。
- mode4/5 中 `friendly` 判定限定 `room.mode <= 3`，故非本人的其他真实参与者均按敌人处理；mode4 无固定 10 杀终局，mode5 无玩家击杀终局，其目标终点留给后续 objectives bridge。

普通玩家复活仍为既有 `respawnTime=3` 秒；未引入 `reviveLimit`，未改 3 秒复活、PendingAmmoFire 取消、role 生命周期或统计重置。`countenemyrealHP`、九奖统计、伤害吸收/critical/弹药 buff/医疗/建筑修复的既有接线保持不变。World 仅在 `fireProjectile` 参数链保留既有 `fired -> countShot` 统计 hook，本切片不改该 hook 与 actors/disguise 绑定。

## 时钟与冻结顺序

`step` 对房间逐帧推进：先递增 `room.tick`，再判定自然时限（到期直接结束、不模拟过期后的移动/命中/复活），否则按实际节拍模拟。`finishRoom` 通过 `finishRound` 的一次性 `phase==='PLAYING'` 门禁冻结结果，合并实际统计、所有结算 producer 以及中途离场的 retired 参与者。`TIME_LIMIT`、最后一命到期、王死亡与离场同步结束共用该冻结链，不发生重复结算。

## 来源事实与采用政策

来源事实：`m001` `TankNum=30`；`m003` `VIPHPMax=200`；`m004` 无击毁阈值字段；模式 5 目标以 `DefaultButt`/`ButtReborn`/`ButtRebornTime` 为候选。

采用政策：mode4 采用时限排行而非固定 10 杀；模式 5 目标 `DefaultButt`/重生 `ButtReborn`/`ButtRebornTime`；普通玩家复活沿用重建 3 秒。来源 `VanishTime` 与 `TankNum` 在模式 5 的玩法含义未恢复，本文不接到玩家复活或目标生命周期。

## 验证边界

本切片未运行 unit、浏览器、build、typecheck、lint 或 exporter，未新增/修改 tests，也未实测 World 超时链、双网页或原服务器逐行为。World/timeLimit 与角色终局的源码静态核对仅覆盖本合同。

## 下一目标 bridge

模式 2 的 Castle 与模式 5 的 Breach 生成/伤害/重生 bridge 尚未由本切片接入，属 objectives worker 的后续范围。World 已有接线入口：`startRoom` 调用 `createObjectives`，`simulateRoom` 的 `hitSceneObject`/`hitObjective` 分支调用 `damageObjective`，`advanceObjectives` 返回真值时以 `OBJECTIVE` 结束，`syncBreachCollision`/`resetBreachCollision` 维护动态 NAV 碰撞。本切片不宣称为完整 M 批 review 或 M2 父项完成。
