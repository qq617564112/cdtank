# 场景元数据加载索引

M3-02/M3-05/M3-07：`export_asset_usage.py` 将原放置的 `animation.library` 关联到 `SceneCvdAnimation.load`，将实际fallback使用的`destruction.library`关联到`SceneBreachVisual.load`，并保留`scene-placements.json`的正式入口。已发布Breach型号优先选原地图库/型号库，catalog字段保留元数据来源关系；已发布范围直接从当前selector读取。每条fallback关系保存原地图、放置 ID、JSON指针和选择入口，不要求资源库文件名直接出现在 TypeScript 源码中。破损绑定由`export_scene_breach_catalog.py`按实际放置和自身c9输出，来源范围见`scene-breach-catalog.md`。

地形与植物目录按对应 owner 的实际 `mapId` 范围关联其动态文件名加载入口。既有全图环境声音与常驻效果目录继续按原四位地图编号关联各自 owner。

索引只记录已发布元数据和代码中的加载关系；实际资源加载、画面与声音的验收状态仍由各任务的原证据决定。本批未运行索引生成、测试、浏览器、构建或类型检查。
