# 剩余12图整批运行时与资源出版边界

本文记录 `MAP-EXT-<mode>-<id>` 剩余 12 图的当前生产接线与出版边界。模式采用范围仍以
`extra-map-mode-support.md` 和 [tasklist.md](tasklist.md) 的 54 条 `MAP-EXT-*` 为准；
原 `m001–m005` 的 13 图 26 组合授权不变。

`scene-placements.json` 已提供 25 图地形、原放置、碰撞盒、出生记录和已解析静态模型。
本批把真实 source 记录接入现有通用消费者，补齐 Castle/Breach/Plant 的图级 producer，
并移除 server 目标规则中的旧地图白名单。目录中已有 scene 文件不等于整图规则、资源出版
或 UI 实测已完成。

## 当前生产接线

server 目录由 `playableMapDirectory(sourceMaps, scene-placements, gamestring)` 生成：
原 13 图 26 组合保持不变，未授权 scene 扩展 `mode<=3`、有 Castle 时的 mode2、有 Breach
时的 mode5，模板规则复用同模式源行，人数采用 `2/12`（mode4/5 为 `1/12`）。
`ListMaps`、`CreateRoom`、`EditRoom`、`Join` 统一读取 `MAPS`。

Web selector `room-map-selector.tsx` 消费 `ListMaps`，按模式取八槽分页、真实地图名、原
`xiaoditu/<mapId>.tga` 预览和确认草稿；`roomMapPage` 的八件分页、
`roomMapPreviewReference` 的原资源名和 `room-create-draft` 的服务端人数边界继续复用。

场景载入按 mapId 读取 `scene-placements.json`、`scene-effects-*.json` 和
`scene-environment-sound-*.json`。`ScenePreview` 以现有 `load()` 分支实例化 12 图
放置，Plant 的 `pendingRound` 快照和 `registerPlant` 通用化，保持 0002 的 scene ready、
加载失败、cleanup、part ready、HUD、movement、Health 和 round reconciliation 语义。

## 当前资源 producer

`recovery/export_scenes.py` 在读完全部 25 图放置后进入
`export_scene_breach_catalog.py` 与 `export_scene_remaining_maps.py` 的导出入口。
`export_scene_remaining_maps.py` 导出 0023 Castle 与八图 Plant。本批 producer 如下：

1. `export_scene_breach_catalog.py` 按原目录大小写识别 Breach 的 `c9.CVD` 与
   `C9.CVD`。0001 的 05440/05441、0008 的 05438 以及 0012/0019 的 05446/05463
   绑定原记录后写入 `destruction.library`/`destruction.reference`；05449/05450 等
   Castle 型号不由 Breach catalog 替代。
2. `sceneBreachLibrary` 消费已发布的 `mapLibraries`、`modelLibraries` 和放置
   `destruction`。`ScenePreview` 仅在实际选中的 Breach 库等于
   `placement.destruction.library` 时，向 `SceneBreachVisual` 传入精确
   `placement.destruction.reference`；专用 map/model 旧库继续使用原引用。
3. `export_scene_remaining_maps.py` 为 0023 写本图 `scene-castle-0023.json` 的
   placement/action 库，使用本图 CAS 身份和 05449/05450 原始 INI 五动作与已发布 GLB，
   不套用 0006 的文件名。
4. `export_scene_remaining_maps.py` 为 0003/0008/0012/0016/0019/0023/0024/0025
   写本图 `scene-plant-<id>.json`；05416 与本批 Plant 型号进入
   `scene-plant-material-*` 与 `ScenePlant05413MaterialOwner`。
5. 0008/0012/0013/0016 的 `scene-effects-*.json` 继续由
   `MapSceneEffects.spawnSceneEffect` 消费。未发布 effect 的图不写空数组冒充。
6. 12 图 `scene-environment-sound-*.json` 继续由 `MapEnvironmentSound` 按图加载；
   asset 匹配走现有 audio catalog，不在场景代码内造声音。
7. 12 图未发布 `scene-terrain-material-<id>.json` 的图保持当前 GLB 材质，不补写同色
   替代材质。

## Server/shared 合同

1. `playableMapDirectory` 是扩展目录唯一来源；不在 `config.ts` 再写 12 图数组，不给 Web
   发第二份地图目录。
2. `castleSceneObjects` 不再按 `[2,5,6,10,11]` 白名单，而是按本图真实 Castle 加 mode1/2
   生成。`getSceneCastles(mapId)` 从本图 CAS 读取源 HP、身份、矩阵和尾段 affiliation；
   mode1 取 CAS HP，mode2 的 `BunkerHP=5000` 来自 `room.map.bunkerHp` 的采用模式模板。
   0001/0003/0008/0012/0013/0023 各两目标；0009/0015/0016/0019/0024/0025 无目标。
3. `createSceneObjects` 的 mode1/3/4 在 `remainingBreachMapIds` 上按本图真实
   `SYcScnObjBreach` 建 ENV；mode5 继续由 `breachObjectives` 建全量 Breach 目标。
   0001/0008 的 05440/05441/05438、0012/0019 的 05446/05463 在同一图目标池内解析。
4. `getSceneSolids`/`getSceneBreakables`/`getScenePlants` 继续从
   `scene-placements.json` 读本图记录；`ScenePreview` 从 `clear()` 到 `load()` 的
   Plant 快照通过 `reconcilePlants` 保留，碰撞和清理走现有 `sceneObjects` 快照。
5. `MapOption` 保持 `{mode,mapId,name,timeLimit,sourceMinPlayers,maxPlayers}`。
   0015/0019/0024 的 G1(12)、0016 的 G1(12)、其余 G0(12) 只在 server 内使用，
   不新增 selector 字段、分页或 feature flag。
6. mode2 Castle 身份取 `sourcePlacementId`、`sourceModel`、CAS 矩阵和尾段 1/2；
   HP 取 `room.map.bunkerHp` 的 `BunkerHP=5000`。mode1 保留源 CAS HP 政策。mode5 目标身份取实际
   `SYcScnObjBreach`，HP/重生走模式 5 表政策；12 图目标池不合并。

## UI 合同

1. `RoomMapSelector` 保持 `ListMaps` 数据源、八槽分页、真实地图名、原预览引用和确认
   草稿；不需要十二图特例页。
2. `ScenePreview` 把新增 Castle/Breach/Plant 资源接到现有 `load()` 分支。0002 的
   scene ready、加载失败、cleanup、part ready、HUD/movement/Health 行为保持现状。
3. Castle 图按 `castleResources`、`castlePresentation`、`damageCastle` 消费 server
   快照；Breach 图按 `sceneBreachLibrary`、`SceneBreachMaterial`、`SceneBreachVisual`、
   `destroyObject` 消费；Plant 图按 `scene-plant-<id>.json` 进入 `ScenePlantSway`
   与本图 root/height/material 记录。
4. `MapSceneEffects` 与 `MapEnvironmentSound` 保持现有协议和 catalog 形状。
5. 未发布图级 JSON 或新增材质/catalog 的场景在 `load()` 边界显式失败并清理，不宣称为
   ready；已有已出版 GLB 的普通静态内容仍按现消费者复用。

## 出版边界

新增 producer 尚未执行，因此新 JSON、材质和 catalog 增量尚未产出。
`scene-castle-0023.json`、0003/0008/0012/0016/0019/0023/0024/0025 的
`scene-plant-*.json`、05416 Plant 材质/catalog 增量，以及 05440/05441/05438 和
05446/05463 的 destruction 字段/库，都是 producer 接线完成但尚未实际出版。
旧 25 图已 published JSON 模型、效果、环境声音和 GLB terrain 保持原范围复用。
未出版资源不得宣称为 ready；可见、破损、摆动、cleanup 和整图开局未实测。

0023 的 05449/05450 Castle `c1/c2/c3/n1/n2` 五动作 source 与 GLB 已存在，
`scene-castle-0023.json` 的图级 JSON 产出是真正缺口。八图 Plant 为
0003/0008/0012/0016/0019/0023/0024/0025，不能漏掉 0008 的 05416。
未知材质只在 GLB 源已有者复用，不假填。

所有 54 条 `MAP-EXT-*` 条目继续保持 `[ ]`，因为原正文验收仍要求规则、页面、联机、
表现和 native/原来源实测。当前代码接通可原位登记，但不能用 code walk 代替实测。

Limitations / Known Issues:

- mode/map 组合、资源实际可见、破损/摆动动画、cleanup、真实双端和 high-definition
  验收未在本轮实测。
- 原 Windows 逐像素等价、原服务器完整伤害/资格规则、全 GPU 材质和全部原回调未恢复。
- 05440/05441/05438 与 05446/05463 的新库、0023 本图 Castle JSON、八图 Plant JSON
  与 05416 材质/catalog 增量未在本轮出版。
- 无 Castle 的图不支持占领模式；G0 缺失点不人工补点。
