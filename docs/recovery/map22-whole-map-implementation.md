# 地图0022整体实现

对应MAP-5-0022及M3场景资源。原m005目录授权本图破坏模式，正式房间资格由mode5/mapId22解析和创建校验；原最低4人、最多12人、时限180秒。

## 整图实现

原46个Breach包含05424×18、05469×28。`scene-placements.json`保留全部原放置；mode5/map22由`createObjectives`经`breachObjectives`从`getSceneBreakables`生成全部46个`SCN:<sourceId>`破坏目标，采用原`DefaultButt=34`初值。目标不重复生成`ENV`场景物件，命中与销毁走`damageObjective`的`objectiveHit`/`objectiveDestroyed`事件，按原m005行`HitScore=10`、`DestroyScore=0`计分。

现存重建政策为：命中扣减HP，归零后标记`destroyedAt`并由`advanceObjectives`按原`ButtReborn=30`、`ButtRebornTime=15`秒调度复活；整图全部目标同时归零时mode5结束。原破损视觉由ScenePreview按`objectiveDestroyed`的`sourcePlacementId`切换对应c9（05424 GA13、05469 GA33）并淡出隐藏。新局经`startRoom`重建全部46个目标。该刷新时序与HP均为Web重建，不新增掉落或原刷新规则。

原地形Data/map/0022/0022.glb与三条环境声音（Sound169 BG06、170 BG11、171 BG12）按既有加载入口。本图无Castle、Crush、Plant、General、常驻Effect或水面。

## 独立消费者与加载入口

两型号Breach完好材质/破损c9由`scene-breach-0022.json`与SceneBreachVisual消费；地形材质、环境声音分别由SceneTerrainMaterial、MapEnvironmentSound按mapId0022资格加载；ScenePreview正式load已含0022。mode5目标由objectives链承载，不与ENV生成重复。

## 验收范围

原46条放置与源身份、两型号完好材质/c9、原地形及三条BG06/BG11/BG12环境声音按各自既有证据范围复用。本图整图生产接线已按现metadata、放置链与场景消费者静态核对，未新增源码接线。未运行测试、浏览器、构建或类型检查。原服务器授权、HP、伤害资格、动态NAV内核、完整实际表现及高清父范围保持未完成。
