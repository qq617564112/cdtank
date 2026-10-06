# 五模式核心运行时

本切片只实现 M2-06 至 M2-10 的服务器核心配置、开局、个人终局判断与 `timeLimitOutcome` API。合同来自 `mode-client-business-design.md` 的 26 行源表和采用政策；World、战斗生命、目标生命周期、结算与 Web 消费不在本切片内。

## 已实现接口

`apps/server/src/config.ts`

`ModeMapConfig` 保留既有地图、奖励、分数和人数字段，新增以下逐行源字段：

| 字段 | 源列 | 用途 |
| --- | --- | --- |
| `defaultButt` | `DefaultButt` | 模式 5 破坏目标初始生命 |
| `buttReborn` | `ButtReborn` | 模式 5 破坏目标重生生命 |
| `buttRebornTime` | `ButtRebornTime` | 模式 5 破坏目标重生秒数 |
| `vanishTime` | `VanishTime` | 保留的源字段；不接玩家复活或碰撞生命周期 |

已移除把 `ButtReborn` 当作玩家复活次数/参数的 `reviveLimit`。普通玩家继续使用现有 `respawnTime=3` 秒；下一 bridge 若还需玩家策略，必须使用真实 player policy，不恢复该误名兼容层。

`apps/server/src/modes/start.ts`

`initializeModeRound(room)` 的返回签名仍为 `(player: ModeParticipant) => void`，并要求房间提供现有稳定 `players` map。模式 1 的 `teamLives` 直接取每方 `map.tankLimit`，不再在 `TankNum <= 0` 时回退 30；`TankNum <= 0` 不构造耗尽胜利条件。模式 3 按稳定 roster 每队第一名有效玩家设置 `vip`，每次开局/再战重新计算，不沿用上局指针。

`apps/server/src/modes/outcomes.ts`

公共导出为：

```ts
timeLimitOutcome(room: ModeTimeLimitRoom): ModeOutcome
```

`ModeTimeLimitRoom` 只依赖 `players`、`teamLives`、`teamScores` 和 `mode`。比较顺序：

| 模式 | 比较顺序 |
| --- | --- |
| 1 | `teamLives` 高者；相等平局 |
| 2 | `teamScores` 高者；相等平局 |
| 3 | 双方 VIP 当前 HP；再比较队伍总击毁；再比较队伍战斗分；仍相等平局 |
| 4 | 个人击毁数，再战斗分；唯一第一取胜 |
| 5 | 个人 `objectivesDestroyed`，再战斗分；唯一第一取胜 |

模式 1 的击杀/友伤终局仍同步返回队伍胜者；模式 3 的王死亡终局仍按对方队伍胜者；模式 4 已删除固定 10 击杀阈值，不再产生击毁目标 `OBJECTIVE`。所有平局返回 `winnerTeam=-1`、`winnerPlayerId=''`；个人模式不按统一 `team=0` 判定胜者。

`apps/server/src/rooms/create.ts`

`targetScore` 初始化改为：模式 2 取 `map.bunkerHp`，其余模式为 0。模式 5 不把 `BunkerHP=0` 或旧 200 回退伪造为目标生命；目标字段由 `config` 的 `defaultButt`/`buttReborn` 供下一 goals bridge 消费。

## 下一 bridge 要求

1. World 的 `TIME_LIMIT` 分支接入 `timeLimitOutcome(room)`，把结果传给现有 `finishRoom`；不要继续让 `computeMatchResult` 单独按旧规则推导 mode3/4/5 超时结果。
2. 模式 2 的目标生成/伤害 bridge 使用源 Castle 和 `map.bunkerHp` 作为规则 HP，并把实际伤害累计到攻击方 `teamScores`；`targetScore` 已为 `bunkerHp`。
3. 模式 3 继续以 `vip` 为唯一王身份，生命初始化使用 `map.vipHp`；不要引入未恢复的 role `+0x98` 倍率。
4. 模式 5 的目标 bridge 使用 `defaultButt` 初始化、`buttReborn` 重生、`buttRebornTime` 调度；`vanishTime` 保持只读源字段。
5. `battle/life` 的 kill/forfeit/casualty 同步终局链保持现状；友伤 bridge 不得给攻击者正值 `HitScore`/`DestroyScore`/击杀奖励，模式 3 友方王死亡判对方胜。

## 验证边界

本切片未运行 unit、浏览器、build、typecheck、lint 或 exporter，未新增/修改 tests，也未实测 World bridge、目标生命周期、双网页、持久账户或原服务端逐行为。`config`、`start`、`outcomes`、`create` 的源码静态核对仅覆盖本合同；父项 M2-06 至 M2-10 仍由后续实现和验收完成。
