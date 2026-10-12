# 五模式 CPU 与 502 修复运行时

本文记录 M2 CPU 目标和 item502 建筑工具从原来源到当前重建策略的边界。World 目标桥、mode2 计分投影和客户端通信不在本文件实现。

## mode2 Castle 目标

原 `m002` 每张地图的 `SYcCastle` 放置是占领目标实体。CAS 尾偏移 4 导出初始生命，尾偏移 8 的归属值 1/2 采用为 team0/1。当前 mode2 规则生命采用 `BunkerHP=5000`；伤害来自普通弹丸命中敌方 Castle 的实际值，不来自站在中立圆内的时间。敌方 Castle 生命归零时由 World 的目标终局结束比赛；时限结束比较累计 `teamScores`，不从占领驻留时间推导。

`apps/server/src/battle/cpu/controller.ts` 的 mode2 消费目标必须同时满足：

- `kind === 'CAPTURE'`、`hp > 0`、`maxHp > 0`；
- `ownerTeam` 为 0 或 1，且不同于 CPU 所在队伍；
- `sourcePlacementId` 和 `sourceModel` 存在于当前 `getSceneCastles(mapId)` 记录，且源归属与 `ownerTeam` 一致。

CPU 只生成普通输入。它使用既有 World 移动、炮塔瞄准和开火路径，弹丸再按现有真实场景查询命中 Castle；控制器不直接写 Castle HP、队伍分或调用 `damageObjective`。既有追敌、光学隐身、宠物/角色回合、用户 NAV steering 和步行路径保留。mode5 继续消费真实 `SYcScnObjBreach` 源放置，既有源碰撞和 NAV 寻路不变，不猜测目标数或重生。mode1/3 的敌人资格和 mode4/5 的个人敌对规则不变。

## item502 建筑工具

item502 的普通 `useItem` 请求经 skill502 的 Target1、TriggerType1、Range0、FuncType18 `x2/y5000` 校验。当前支持：

| 模式 | 目标身份 | 生命上限 |
| --- | --- | --- |
| 模式 1 | 源 CAS 归属为本队的 Castle | CAS 导出的 `source.hp` |
| 模式 2 | 源 CAS 归属为本队的 Castle | `map.bunkerHp` |

目标必须是当前 `sceneObjects` 中与源 `CASTLE:` 身份一致的存活、受损条目。选择顺序为源放置顺序，不增加目标负载或距离判定，不复活 `hp<=0` 的已毁 Castle，也不把 Breach 当作可修复目标。

认证顺序先检查房间模式、玩家存活与 `status2`、本局/账户库存和合格目标，再调用现有 `consumeItem` 持久 CAS。CAS 成功返回后才扣减账户库存与本局数量并增加目标 HP；CAS 失败或抛异常时不修改目标或库存。成功事件复用既有 `itemUsed`、`sceneObjectHealed` 和 `castleDamage` 负载，恢复量按 skill `y5000` 与实际生命上限夹取。

CPU `buildingToolHotkey` 也只在 mode1/2、角色存活 `status2`、已配置的有限 item502 快捷槽 5..8 且 `ownedQuantity`/`battleQuantity` 均大于 0 时，为真实受损本队 Castle 返回槽位。该函数只产生普通 use 输入，不发放物品，不增加距离策略。

## 共享权威

当前修复路径只通过现有 `SceneObjectSnapshot` 增加 HP，不建立 side cache 或镜像。最终 bridge 必须让 Castle 目标、World 弹丸查询和修复使用同一权威 HP：修复不得扣减敌人对 Castle 的累计伤害，也不得让 mode2 因修复提前达到 `teamScore` 终点。World 目标桥和共享身份接入由 root 后续完成。

## 验证边界

未运行 unit、浏览器、build、typecheck、lint 或 exporter，未修改 tests，也未实测 World mode2 Castle 桥、双端伤害/修复、累计分、目标终局或 CPU 自主使用。源码静态核对只覆盖本文与上述三个运行时文件；真实双端和采用策略接入完成前不能写成验收通过。
