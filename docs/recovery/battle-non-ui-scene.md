# 战斗非 UI 场景接线

## 原来源

- 原 `4272d7` 的 `scene+1e8` 分类包含 Plant 与 Crush。静态预测 OBB 相交后的 type100 不阻止普通运动，隐藏路径为 `44e081 -> 45efb3 -> 461dd9`。
- 首次调用立即隐藏，可选启动 051，重复通知静默。
- Map1 有 13 个 enabled obj05459；Map7 obj05420 为 enabled76/77、disabled75。obj05459 与 obj05420 的原 loader 均 retain 051。
- 当前 `scene-placements.json` 中真实 Crush 只出现在 map1/map7。模型和 051 均已具备真实源；Plant 的真实 OBB 由 `getScenePlants` 提供。
- 全部 25 图已有房间入口；Plant 共 14 张原图另有测试 1001。

## 采用规则

- `createScenePlants(room)` 直接读取 `getScenePlants(room.map.mapId)`，不按模式或地图白名单裁剪。
- `createSceneCrushes(room)` 直接读取 `getSceneCrushes(room.map.mapId)`，按真实 enabled 建立 `hidden: !enabled`，不按固定模型集合裁剪。
- `querySceneCrush(start,end,states,mapId)` 使用传入 mapId 的真实源 mesh footprint；`shot-query.ts` 传入 `Number(battlefield.source.id)`。
- `acceptSceneCrush` 从真实源取得 matrix；首次隐藏调用 `room.battlefield.setDynamicBox(undefined,target.id)`，产生中性 `sceneCrushed` 事件，不伪造 `shotItemResult`。
- `sceneCrushContactColliders` 与 Plant 使用相同静态碰撞器格式，enabled 且未 hidden 的 Crush 首次 notify 调用 `acceptSceneCrush`。
- `world` 的 `staticObjects` 回调保持 Plant 后 Crush 的组合顺序；真实 `2001` 射击处理和既有事件保持独立。
- 普通 manual pose 的 move/turn 输入先经 `createBattleMovementCollider` 与 `isRoleControllerMovementAllowed`：动态同行者门禁先于静态对象 type100 通知。零输入仍只检查当前 OBB，已接受 pose 和坦克 authority 不跳位置。预测读路径不产生隐藏副作用。
- Web 以 `sceneCrushed && sceneCrush` 直接调用 `battlefield.crush`，不要求 `shotItemResult`。`ScenePreview` 的 Plant 注册按真实 `SYcScnObjPlant`，Crush 分支按真实 `SYcScnObjCrush` 且模型为 obj05420/obj05459、runtime 存在时接入，复用 `sceneCrushTransform`、051 retain、`SceneCrushPresentation`、root 注册、round 与 clear。

## 未实测

未运行测试、构建、类型检查、lint 或浏览器验收。旧 Crush/Plant 运动接触 runner 未运行；双端实际呈现与完整运动/场景父验证仍未完成。
