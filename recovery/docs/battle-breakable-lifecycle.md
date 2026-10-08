# 普通模式 Breach 生命与局内重生

本切片补齐模式 1–4 普通 `SYcScnObjBreach` 的地图 HP 与局内重生。模式 2 的 Castle
终点、模式 5 的目标池/计分/全清/重生，以及既有掉落、Crush、Plant 规则均保持不变。

## 来源字段

`m001`–`m004` 的每张合法地图行都提供 `DefaultButt`、`ButtReborn` 与
`ButtRebornTime`：

- `DefaultButt`：普通 Breach 初始 HP。
- `ButtReborn`：一次真实击毁后恢复的 HP。
- `ButtRebornTime`：从 `destroyedAt` 到恢复的秒数。

模式 1、3 的源行值可见 `recovery/output/verified/tables/m001.json` 与
`m003.json`；模式 2、4 可见 `m002.json`、`m004.json`。这些字段在全部当前合法
模式 1–4 行中均为正数。原服务端的精确对象更新函数未取得，因此下述零值边界是本
项目采用规则，不冒称原服务端逐行为复刻。

## 采用规则

- `createSceneObjects` 在模式 1–4 使用当前模式地图行的 `DefaultButt` 同时初始化
  普通 Breach 的 `hp` 与 `maxHp`。Castle 仍按既有 CAS/BunkerHP 规则生成。
- 普通 Breach 的真实击毁只写既有 `destroyedAt`，不创建 `ObjectiveSnapshot`，不加
  命中、摧毁或模式积分。掉落仍由现有 `sceneObjectDestroyed` 链按
  `sourcePlacementId + destroyedAt` 去重。
- `advanceObjectives` 在模式 1–4 最前调用 `advanceSceneObjects`。目标满足
  `now >= destroyedAt + ButtRebornTime * 1000` 时，在同一原实例上恢复为
  `ButtReborn`，同步更新 `maxHp` 并清除 `destroyedAt`。
- 生命周期没有额外的私有计时状态；当前 `destroyedAt` 已足够跨 tick、重连快照和
  World 同步消费。开局/再战由 `createSceneObjects` 自然重建，换图/换轮不会遗留
  旧状态。
- `DefaultButt <= 0` 视为该行不生成普通 Breach；`ButtReborn <= 0` 或
  `ButtRebornTime <= 0` 视为自动重生禁用，目标保持已销毁状态。该规则避免零 HP
  在每 tick 被重新安排，也避免零生命实例继续占用碰撞。

## 同步与表现

`syncSceneObjectCollision` 继续保留现有 2 秒破损淡出/碰撞延迟。若
`ButtRebornTime` 小于 2 秒，提前恢复的正 HP 快照会让客户端只重置该 Breach 的
破损状态和动态盒体，不会先移除再重建；若重生时间更长，碰撞在隐藏后释放，到期时
由同一实现重新加入。客户端仍只按权威 `hp/destroyedAt` 消费，不在本地推导击毁或
重生。

普通 Breach 恢复后再次击毁会在新的 `destroyedAt` 上重新走既有一次掉落，但同一次
击毁不会重复掉落，也不恢复已拾取或已销毁的地面实体。

## 接口

- `apps/server/src/battle/environment.ts`
  - `createSceneObjects(room)` 读取模式地图的 `defaultButt`。
  - `advanceSceneObjects(room, now)` 推进模式 1–4 的普通 Breach 重生。
- `apps/server/src/modes/objectives.ts`
  - `advanceObjectives(room, now)` 现在要求 `room.sceneObjects`，先在模式 1–4
    调用 `advanceSceneObjects`，随后保留原来的模式 2 终点和模式 5 分支。

World 已有的 `room.objectives = createObjectives(room, BODY_RADIUS)`、
`room.sceneObjects = createSceneObjects(room)`、`advanceObjectives(room, now)` 与
`syncSceneObjectCollision(room, now)` 顺序无需改动。

## 验证边界

本切片未运行 unit、浏览器、构建、类型检查、lint 或资源生成器。上述为生产接线与
静态来源核对；原服务端零值语义、实际客户端短于 2 秒重生的像素时序、完整联机局
仍待后续实测。
