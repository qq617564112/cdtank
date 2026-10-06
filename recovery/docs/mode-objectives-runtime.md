# 五模式目标运行时

本切片实现 `mode-client-business-design.md` 与 `mode-core-runtime.md` 的目标桥接契约在
`apps/server/src/modes/objectives.ts`、`apps/server/src/battle/environment.ts`、
`apps/server/src/battle/breach-collision.ts` 三个归属文件中的服务端规则与生命周期。
World 路由、共享 schema、UI 与结算由各自 bridge 子项继续接入；本文件只描述已实现的
可调用接口、必须的房间 state 和不变量。来源事实与采用政策分列。

## 已实现接口

`apps/server/src/modes/objectives.ts`

```ts
interface ObjectiveEnd { winnerTeam: number; winnerPlayerId?: string; }

createObjectives(room: ObjectiveRoom): ObjectiveSnapshot[]
advanceObjectives(room: ObjectiveRoomClock, now: number): ObjectiveEnd | undefined
damageObjective(room: DamageObjectiveRoom, owner: DamageObjectiveOwner,
  target: ObjectiveSnapshot, bulletDamage: number, now: number, events: MsgRoomEvent[]): void
isCastleObjective(objective: Pick<ObjectiveSnapshot, 'id'>): boolean
```

`advanceObjectives` 以真实服务器毫秒时钟 `now` 判定，不再接收猜测 dt。bridge 必须传入
与快照 `serverTime` 同源的毫秒值。返回 `undefined` 表示本 tick 未终局；返回
`{winnerTeam}` 表示规则终局（`winnerTeam >= 0` 为队伍胜，`-1` 为需要个人排名的模式 5）。

`apps/server/src/battle/environment.ts`

```ts
interface CastleTargetSnapshot extends SceneObjectSnapshot, ObjectiveSnapshot { kind: 'DESTROY'; }

castleSceneObjects(room: CastleRoom): CastleTargetSnapshot[]
createSceneObjects(room: CastleRoom): SceneObjectSnapshot[]
damageSceneObject(room, owner, target, damage, now, events): void
syncSceneObjectCollision(room, now): void
resetSceneObjectCollision(field: Battlefield): void
```

`apps/server/src/battle/breach-collision.ts`

```ts
syncBreachCollision(room, now): void
resetBreachCollision(field: Battlefield): void
```

## 模式 2 占领

**来源事实**

- `SYcCastle` 源记录身份、矩阵、模型与 CAS 尾段归属 1/2 来自 `.cas` 放置。
- `m002` 授权 5 图（0002/0005/0006/0010/0011）各 2 个 Castle；`BunkerHP=5000`。
- 原 HUD 累计双方对敌方 Castle 的伤害以整数截断显示。

**采用政策**

- `createObjectives` 的模式 2 分支直接返回 `castleSceneObjects(room)`，与
  `createSceneObjects` 使用同一 per-room 记忆实例。`room.objectives` 的 Castle 元素与
  `room.sceneObjects` 的 Castle 元素是同一对象引用：规则 HP、渲染 HP、`destroyedAt`
  与销毁生命周期不会分裂成“视觉 2000 / 规则 5000”两份实体。
- 目标 HP 初始化为 `map.bunkerHp`（5000）；`targetScore` 仍是该上限，仅用于显示，
  胜负只读真实 Castle HP。
- `damageSceneObject` 只对真实敌方 Castle 的 HP 减少累计到攻击方 `teamScores`；己方
  Castle 受伤仍扣同一实例 HP，但不产生友方正分。命中事件仍带
  `castleDamage{castleId,currentHP,maxHP,delta}`。
- `damageObjective` 作为同一 Castle 的备用入口也按同一 `teamScores` 规则累计，保证两条
  命中路由不会产生分叉。只有真实 HP 减少才计数；对已摧毁实例的命中被拒绝。
- `advanceObjectives` 模式 2 只在该 Castle HP 为 0 时返回攻击方队伍胜。累计伤害到
  `targetScore` 不构成胜利，被修复（HP>0）的 Castle 依然存活。
- 既有 `buildingTool`（item502/skill502）按 `CASTLE:<id>` 的同一实例恢复 HP，
  模式 1 的修复政策与 CPU 选择链不变；模式 2 复用同一真实实体，不新增第二条修复路径。

**不变量**

- 目标与场景对象同 identity（`CASTLE:<sourcePlacementId>`）、同 `sourcePlacementId`、
  同 `hp/maxHp/destroyedAt`。
- 没有中立 `radius=90` 圈、30 秒驻留或按圈人数加分；`advanceObjectives` 不读取玩家位置。
- 不为缺失 Castle 的地图构造兜底 sphere；无源 Castle 时模式 2 目标为空。
- 模式 1 Castle 仍取 CAS 记录 HP，环境 breakable 仍为既有重建 200 HP。

## 模式 5 破坏

**来源事实**

- 每张 `m005` 地图的全部 `SYcScnObjBreach` 放置：0020=117、0021=73、0022=46。
- `DefaultButt` 123/77/34 为初始 HP；`ButtReborn` 90/60/30 为重生 HP；
  `ButtRebornTime=15` 秒为重生间隔；`HitScore=10`、`DestroyScore=0`。
- 客户端 `45e7b0` 把 Breach 切破损模型并按视觉相位淡出后在隐藏时清理包围。

**采用政策**

- `createObjectives` 模式 5 从 `getSceneBreakables(mapId)` 取全部真实放置，身份、模型、
  矩阵和 OBB 来自源记录，HP 取 `map.defaultButt`。三球体临时目标与
  `bunkerHp || 200` 回退已移除。
- `damageObjective` 按实际伤害扣 HP，累加源 `hitScore`；HP 归零时计一次
  `objectivesDestroyed` 并加 `destroyScore`。HP 已为 0 的实例不再受伤或计分。
- 重生调度使用既有 `destroyedAt` 作为销毁时刻、私有 `rebornAt` 作为到期时刻，均不进
  共享 schema。`advanceObjectives` 在 `now >= destroyedAt + buttRebornTime*1000` 时把
  HP 重置为 `buttReborn`、清空 `destroyedAt`。客户端只需观察 `hp/destroyedAt`。
- 全清判定为同一时刻全部当前 Breach `hp<=0`。已在本 tick 重生的目标 HP>0，
  因此不构成全清；否则返回 `{winnerTeam:-1}`，由结算/超时按累计 `objectivesDestroyed`
  与战斗分排序。
- 每 2 秒淡出窗口内保留动态 NAV/碰撞盒，隐藏后释放；重生时按同一 `sourcePlacementId`
  重新加入，不新增其它物体碰撞。`resetBreachCollision` 在换局/离房释放全部 owned 盒。

**不变量**

- 模式 5 目标池恒等于源 Breach 放置集合；不追加 200 HP 兜底目标。
- `syncBreachCollision` 只在 `mode===5` 且地图为 0020/0021/0022 时生效，盒子几何来自
  源 Breach 的 `mesh/dimensions`；`resetBreachCollision` 幂等释放。

## World 必须的路由顺序

1. 开局/再战：对同一 `RoomState` 先 `room.objectives = createObjectives(room)`，再
   `room.sceneObjects = createSceneObjects(room)`；两者模式 2 共享 Castle 实例，
   模式 5 目标与场景盒子共享 placement。随后 `syncSceneObjectCollision(room, now)`、
   `syncBreachCollision(room, now)` 用同一 `now`。
2. 命中：模式 2 Castle 走 `hitSceneObject`（`segmentBox(getSceneCastles)`），调用
   `damageSceneObject`，同一实例同步渲染与规则 HP；若桥接改为走 `hitObjective`，
   必须传同一 `teamScores`，不得同时再走第二条路径造成重复扣血/计分。
   模式 5 Breach 走 `hitObjective`（`segmentBox(getSceneBreakables)`），调用
   `damageObjective`。
3. 每 tick 战斗后：先 `advanceObjectives(room, now)` 处理重生与规则终局，再
   `syncBreachCollision(room, now)`、`syncSceneObjectCollision(room, now)` 同步碰撞/NAV。
   若返回终局，`winnerTeam>=0` 直接把该队伍交给 `finishRoom(..., 'OBJECTIVE', ...)`；
   `winnerTeam<0` 交给现有超时/结算排序链按 `objectivesDestroyed`、战斗分决定个人胜者。
4. 时限：模式 2 比较 `teamScores`（累计真实敌方 Castle 伤害）高者胜，相等平局；
   模式 5 交由 `timeLimitOutcome` 按累计摧毁数与战斗分。

## 验证边界

本切片未运行 unit、浏览器、build、typecheck、lint 或 exporter，也未新增/修改测试。
World 路由、共享 schema、UI 投影、结算排序与掉落业务由各自 bridge 子项继续接入；
本文件的接口与不变量为下一桥接实现的准确输入。
