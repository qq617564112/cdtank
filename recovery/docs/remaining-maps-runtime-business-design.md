# 剩余12图整批运行时与资源接口合同

本文是 `MAP-EXT-<mode>-<id>` 剩余 12 图整批实施的接入合同。采用模式范围以
`extra-map-mode-support.md` 和 `tasklist.md` 的 54 条 `MAP-EXT-*` 为准，本文不重排或
扩写模式矩阵，也不把 12 图纳入原 `m001–m005` 的 13 图 26 组合授权。

`scene-placements.json` 已能提供 25 图地形、原放置、碰撞盒、出生记录和已解析静态模型；
12 图不是“没有场景数据”。本批要做的是把真实 source 记录接入现有通用消费者、补齐
Castle/Breach/Plant 的图级资源 producer，并消除 server 目标规则的地图白名单。目录中
存在某图不等于其整图规则、资源或 UI 已完成。

## 当前正式入口

server 当前以 `apps/server/src/config.ts` 的 `MAPS` 为权威目录。main 上该目录由
`playableMapDirectory(sourceMaps, scene-placements, gamestring)` 生成：原 13 图 26 组合
保持不变，已发布 scene 会为未授权地图扩展 `mode<=3`、有 Castle 时的 mode2、有 Breach 时的
mode5，模板规则复用同模式首个源行，人数采用 `2/12`（mode4/5 为 `1/12`）。当前 worktree
的 `config.ts` 仍是静态 `m001–m005` registry；实施时以 main 的 `map-directory.ts` 为
基线，不新增第二套目录 API。

`ListMaps`、`CreateRoom`、`EditRoom`、`Join` 已统一读取 `MAPS`。Web selector
`room-map-selector.tsx` 完全消费 `ListMaps`，按模式取八槽分页、真实地图名、原
`xiaoditu/<mapId>.tga` 预览和确认草稿；它不需要改成“十二图特例页”。`roomMapPage` 的
八件分页、`roomMapPreviewReference` 的原资源名和 `room-create-draft` 的服务端人数边界
可直接复用。

场景载入已经按 mapId 读取 `scene-placements.json`、`scene-effects-*.json` 和
`scene-environment-sound-*.json`。`ScenePreview` 的通用实例化、Castle 资源、
Breach 破损切换、Damage 字体、移动几何、cleanup 和 round reconciliation 均按现有
0002 实现路径复用；不新增 ScenePreview 子类、fake API、feature flag 或迁移层。

## 逐图已存在与未挂载项

表中“已发布”指当前 `recovery/output/web-assets` 已有正式文件。source 可读、目录可解析或
模型可转换都不等于当前消费者已启用。“整图接通”指一次完成该图在当前支持模式下的
server 目标、Web 资源和 cleanup 闭环，不拆单消费者验证。

| 图 | source scene | 当前已正确复用 | 本批必须挂载 | 明确缺口/边界 |
| --- | --- | --- | --- | --- |
| 0001 不毛岛 | 46 records + 2 castles；G0 12；32 Breach；13 Crush；1 Sound | 地形/碰撞/出生；obj05447/05448 Castle 模型已可按 0006 库复用；Crush 05459 已发布 | mode1/2/3/4/5 目录；mode2 两 Castle 目标；mode5 32 Breach 目标；05440/05441 破损切换 | 05440/05441 原目录只有 `C9.CVD` 大写名，需 catalog 精确识别；不新增同类替代。Castle 05447/05448 走 0006 资源库 |
| 0003 蛋糕南路 | 89 records + 2 castles；G0 12；31 Breach；52 Plant；1 General；5 Sound | 地形/碰撞/出生；Castle 05447/05448；Breach 05422/05423/05432 均已有模型/材质；Plant 05413 已发布；General 05015 记录存在 | mode1/2/3/4/5 目标与 Plant root 状态；General 保持不可破坏 | Castle 复用 0006 资源库但不能套用 0006 的目标 ID/HP；Plant 摆动资源仍缺本图专用 `scene-plant-0003.json` 时才登记正式资格 |
| 0008 废弃魔王路 | 195 records + 2 castles；G0 12，G1 9/2；105 Breach；82 Plant；1 General；1 Sound | 地形/碰撞/出生；Castle 05447/05448；05442/05460/05461 Breach 资源已发布；4 个 `scene-effects-0008.json` 效果；Plant 05416 模型已发布 | mode1/2/3/4/5；mode2 两 Castle；mode5 105 Breach；G0 固定采用；Plant/General root | 05438 原目录只有 `C9.CVD` 大写名，需精确识别；G1 只有 2 个 NAV 可用点，继续采用 G0，不为凑 12 点改选择器 |
| 0009 秘密工厂迷宫 | 58 records；G0 12；55 Breach；2 General；1 Sound | 地形/碰撞/出生；05424/05442 Breach 模型/材质已发布；General 05018 原记录存在 | mode1/3/4/5；mode5 55 Breach 目标；General 保持普通静态 | 原 CAS 为空，不得新增 mode2；两个 General 不进 Breach 目标池 |
| 0012 不是约翰的路田园 | 92 records + 2 castles；G0 12；55 Breach；28 Plant；4 Sound；4 Effect | 地形/碰撞/出生；Castle 05447/05448；05422/05425/05426/05428/05432 资源已发布；`scene-effects-0012.json` 4 个效果 | mode1/2/3/4/5；mode2 两 Castle；mode5 全 55 Breach；Plant 05413 root；Hook/Sound/Effect 归各自 owner | 05446×2、05463×3 原目录有 c9，但当前 catalog 未发布图级 destruction 字段；需 catalog producer，不在 UI 猜材质 |
| 0013 凄凉魔王路 | 31 records + 2 castles；G0 12；26 Breach；1 Sound；2 Effect | 地形/碰撞/出生；Castle 05447/05448；05460/05461 Breach 资源已发布；`scene-effects-0013.json` 2 个效果 | mode1/2/3/4/5；mode2 两 Castle；mode5 26 Breach | Castle 复用 0006 库；目标身份必须取本图 CAS，不按模型数量映射 |
| 0015 秘密工厂仓库 | 44 records；G0 12/5，G1 12/12；41 Breach；2 General；1 Sound | 地形/碰撞/出生；05424/05442 资源已发布；General 05018 原记录存在 | mode1/3/4/5；mode5 全 41 Breach；按 G1(12) 固定出生政策 | 无 Castle；原 selector 现采 G0(5) 偏少，采用政策改为 G1(12)；不得给 G0 造假点 |
| 0016 仙剑岛秘密仙境 | 133 records；G0 12/0，G1 12/12；7 Breach；107 Plant；6 Sound；12 Effect | 地形/碰撞/出生；obj05432 Breach 资源已发布；`scene-effects-0016.json` 12 个效果；Plant 05401/05403/05405/05413 模型已发布 | mode1/3/4/5；mode5 7 Breach；G1(12) 固定；Plant root/摆动资格 | 无 Castle；WaterFall/Sequence 不是替代目标；Plant 需本图专用摆动资源，不能只凭 GLB 已发布宣称已摆动 |
| 0019 田野路南瓜大丰收 | 82 records；G0 3/3，G1 12/12；47 Breach；32 Plant；3 Sound | 地形/碰撞/出生；05428/05463 Breach 模型已发布；Plant 05413 模型已发布 | mode1/3/4/5；mode5 47 Breach；按 G1(12) 固定出生政策；Plant root | 无 Castle；05463 图级破损字段需 catalog；G0 现仅 3 可用点，不改写为 12 |
| 0023 春节版仙剑岛 | 126 records + 2 castles；G0 12；46 Breach；73 Plant；4 General；3 Sound | 地形/碰撞/出生；05421/05423/05432/05433/05443 Breach 资源已发布；05449/05450 五动作 GLB 已发布；Plant 05401/05403/05405/05413 模型已发布 | mode1/2/3/4/5；mode2 Castle 本图资源/目标；mode5 46 Breach；Plant root；General 05424 保持普通 | Castle 05449/05450 的原 `c1/c2/c3/n1/n2` 已存在，真正缺口是本图 `scene-castle-0023.json` 和 ScenePreview 资格；不得用 05415/05416 同类替代 |
| 0024 圣诞节版魔王山 | 128 records；G0 3/2，G1 12/12；15 Breach；110 Plant；3 Sound | 地形/碰撞/出生；obj05469 Breach 资源已发布；Plant 05401/05403/05405/05413 模型已发布 | mode1/3/4/5；mode5 15 Breach；按 G1(12) 固定出生政策；Plant root | 无 Castle；不得从空 CAS 推测占领；G0 现仅 2 可用点，不改写为 12 |
| 0025 情人节版早安公园 | 53 records；G0 12；16 Breach；34 Plant；3 Sound | 地形/碰撞/出生；obj05466 Breach 资源已发布；Plant 05413 模型已发布 | mode1/3/4/5；mode5 16 Breach；Plant root | 无 Castle；仅 1/3/4/5；不得新增占领目标 |

## Server/shared 合同

一个 worker owns `apps/server`、`apps/shared` 及 resource producer/catalog：

1. 保留 `sourceMaps` 的原 13 图 26 组合；扩展目录仍由 `playableMapDirectory` 产生。不要
   在 `config.ts` 再写 12 图数组，也不要给 Web 发第二份地图目录。
2. 将 `castleSceneObjects` 的 `[2,5,6,10,11]` 白名单改为“本图真实 Castle + 模式 2/1”，
   并保留 `getSceneCastles(mapId)` 从本图 CAS 读取身份、矩阵、尾段归属和模式 2 的
   `BunkerHP`。0001/0003/0008/0012/0013/0023 各两目标；0009/0015/0016/0019/0024/0025
   无目标。
3. 将 `createSceneObjects` 的 mode1/3/4 地图白名单改为按本图真实 `SYcScnObjBreach`
   和目标模式决定。mode5 继续由 `breachObjectives` 建全量 Breach 目标；mode1/3/4 的
   ENV 只沿本图明确目标池，不把全部静态模型当破坏物。0001/0008 的 05440/05441/05438
   以及 0012/0019 的 05446/05463 必须在同一地图目标池内解析。
4. `getSceneSolids`/`getSceneBreakables`/`getScenePlants` 继续从
   `scene-placements.json` 读本图记录；不为 12 图复制碰撞数据。动态碰撞在断点后按现
   2 秒规则退出，目标重生/清理走现有 `sceneObjects` 快照。
5. `MapOption` 保持 `{mode,mapId,name,timeLimit,sourceMinPlayers,maxPlayers}`；若需要
   表达 0015/0019/0024 的固定出生组，只在 server 地图政策内部使用 `mapId`，不新增
   selector 专用字段、不新增分页、不新增 feature flag。
6. 0015/0019/0024 采用 G1(12) 固定政策，0016 继续 G1(12)，其余采用已证 G0(12)。
   不改写 RPT，不给 G0 补点，不把出生组当队伍。
7. mode2 的 Castle 目标身份取 `sourcePlacementId`、模型、CAS 矩阵和尾段 1/2；HP
   取本图模式政策 `BunkerHP=5000`。mode1 保留源 CAS HP 的现有政策；不在 UI 计算。
8. mode5 目标身份取实际 `SYcScnObjBreach`；HP/重生采用模式 5 表政策模板。12 图各自
   的真实放置数不合并成一个目标池。

## Resource producer 合同

现有 `export_scenes.py` 已产出 `scene-placements.json`，并在读完全部 25 图放置后调用
`export_scene_breach_catalog.export`。本批只做以下精确扩展，均由 server/shared worker
负责：

1. `export_scene_breach_catalog.py`：按原目录大小写识别 `c9.CVD` 与 `C9.CVD`；为
   0001/0008 的 05440/05441/05438 和 0012/0019 的 05446/05463 写出与原记录绑定的
   `destruction.library`/`destruction.reference`。不得用 05415/05416 或其它同类模型替代
   05449/05450；不得给原目录无 c9 的型号伪造破损。
2. 若当前 catalog 尚未发布共享库文件，则在 `export_models` 既有转换资产基础上生成
   Breach 库；`sceneBreachLibrary` 已能消费 `mapLibraries`、`modelLibraries` 和放置
   `destruction`。UI worker 只消费已发布 JSON。
3. `scene-castle-0023.json`：按 0006 producer 的相同 Castle 资源合同，读取 0023 CAS
   两个实例及 05449/05450 原始 INI 五动作与已发布 GLB，写出本图 placement/action 库。
   本图 Castle 不能继续借用 0006 的资源文件名。
4. Plant：0003/0012/0016/0019/0023/0024/0025 的原 Plant 模型已在 GLB 目录，但当前
   `ScenePlantSway` 只打开 0002/0004/0005/0006/0017/0021。若本批要启摆动，必须按现有
   `scene-plant-<id>.json`/`ScenePlant05413MaterialOwner` producer 发布各自
   placement/height/material 记录；否则保持静态 root，不在 `scene-preview.ts` 里伪造
   height、phase 或材质。
5. 0008/0012/0013/0016 的 `scene-effects-*.json` 已发布；沿用
   `MapSceneEffects.spawnSceneEffect`。未发布 effect 的图不应以空数组或同类资源伪装。
6. Sound：12 图均有正式 `scene-environment-sound-*.json`。继续由
   `MapEnvironmentSound` 按本图文件加载；缺 asset 时由现有 audio catalog 的 asset 匹配
   决定，不在场景代码内造声音。
7. Terrain material：已发布的 12 图只有通用地形 GLB 与部分具名材质文件；没有
   `scene-terrain-material-<id>.json` 的图保持当前 GLB 材质，不补写同色替代材质。

资源缺口分为两种，不能混写：

- **已存在原 source、尚未发布到 Web**：05440/05441/05438 的 `C9.CVD`、05446/05463 的
  `c9.CVD`、0023 的 Castle 05449/05450 五动作、12 图 Plant sway 资源库。
- **原 source 本身无对应资源**：不得为 05449/05450 另找模型代替，不得因 05438/05440/
  05441 没有小写 c9 就改称损坏图或造替代破损。

## UI 合同

另一 worker owns `apps/web` 的 ScenePreview 选择器、地图资源 manifest 和 UI 挂载，不改
server/shared registry：

1. `RoomMapSelector` 不改数据源和交互模式；它继续消费 server `ListMaps`。新增地图出现后
   由现有 `roomMapPage` 自然过滤/分页，真实 12 图名称和原预览资源走现有
   `roomMapPreviewReference`。
2. `ScenePreview` 只把新增 Castle/Breach/Plant 资源接到现有 `load()` 分支。0002 的
   scene ready、加载失败、cleanup、part ready、HUD/movement/Health 行为保持现状；不为
   12 图复制另一套生命周期。
3. 有 Castle 的图按 `castleResources` + `castlePresentation` + `damageCastle` 消费当前
   server 快照；有 Breach 的图按 `sceneBreachLibrary`、`SceneBreachMaterial`、
   `SceneBreachVisual` 和 `destroyObject` 消费；Plant 先保持已发布的原 root/placement，
   只在对应 `scene-plant-*.json` 发布后交给 `ScenePlantSway`。
4. `MapSceneEffects` 已覆盖所有 12 图文件入口；不改效果协议。`MapEnvironmentSound` 已按
   图号和 audio catalog 运行；不改声音 API。
5. 不新增 fake API、通用 feature flag、迁移框架、资源哈希门或分页 API。UI 不判断原
   source 是否有 c9；没有发布库时保持现有静态实例和明确失败/缺资源边界。

## Whole-batch ownership

`maps-server` worker：

- owned：`apps/server/src/config.ts`、`apps/server/src/config/map-directory.ts`、
  `apps/server/src/scene-objects.ts`、`apps/server/src/battle/environment.ts`、
  `apps/server/src/modes/objectives.ts`、`apps/shared/maps/castle-resources.ts`，
  以及 `recovery/export_scene_breach_catalog.py`、Castle/Plant 对应 producer 与
  `apps/web/src/assets/scenes/scene-breach-resources.ts` 的地图模型映射。
- 交付：12 图可建房的 mode/map 组合，mode2/5 真实目标，Castle/Breach 资源发布，
  G1(12) 固定出生政策，整图 producer 文件。

`map-ui` worker：

- owned：`apps/web/src/interface/lobby/room-map-selector.tsx`、
  `room-map-options.ts`、`apps/web/src/assets/scenes/scene-preview.ts` 的新增资源挂载，
  以及 `scene-castle-*`/`scene-breach-*`/`scene-plant-*`/`scene-effects-*` 的文件 manifest。
- 交付：真实 selector 展示与资源选择，ScenePreview 整图资源接入，0002 现有场景
  资格/错误/清理语义复用，HUD/移动/Health 不因扩展图改变。

不需要变动：

- `ListMaps`/`CreateRoom`/`EditRoom`/`Join` 的协议形状；
- `RoomMapSelector` 的八槽分页和 UI 交互模型；
- 0002 的 ScenePreview lifecycle、Damage 字体、movement geometry、cleanup；
- `MapSceneEffects`/`MapEnvironmentSound` 的协议和 catalog 形状。

## 交付与未完成边界

本批的完成标准是“目录/整图生产接入成立且资源缺口明确”，不是把 54 个模式逐项宣称实测
通过。每个 mode/map 条目继续以规则、页面、联机、表现实测为父验收；全部 MAP-EXT 父项
保持 `[ ]`。

12 图当前可立即接入的基础：terrain、碰撞盒、出生记录、通用实例化、Castle 资源路由、
Breach 材质/资源库、scene effects、environment sound、selector 分页、server
Create/Edit/Join/ListMaps、ScenePreview cleanup。必须后置的 resource gate：05440/
05441/05438 与 05446/05463 的 destruction 字段/库、0023 本图 Castle 资源、
0003/0012/0016/0019/0023/0024/0025 的 Plant sway 资源库，以及未发布的地形材质文件。

这些缺口不阻塞 server 目录与规则整批实现，也不阻塞已有资源图的 Web 挂载；只有对应
资源声明为可见/破损/摆动时，才要求 producer 文件先发布。不得因缺源停止所有 12 图实现，
也不得把未出版资源宣称为 ready。

未恢复或不声称：

- 原 Windows 逐像素等价、原服务器完整伤害/资格规则、全 GPU 材质和全部原回调；
- 0001/0008 缺失小写 c9 的替代模型；
- 无 Castle 图的占领模式；
- G0 缺失点的人工补点；
- 12 图所有父项完成度。
