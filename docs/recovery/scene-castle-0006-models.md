# 森林原 Castle 模型与正式接线

0006 两原 Castle81/obj05449、82/obj05450 的五动作已接正式 ScenePreview/SceneCastleVisual。原 obj05449 INI 首项 c2；正式消费者按名字选择，入场复用原45dd2d n1(mode0)合同。原资源、正式入场及离房重入清理已核对；玩家可辨 Castle 输出尚未验收。

地图线拥有 `export_scene_castle06.py`、`scene-castle-0006.json`、`export_scenes.py` 独立 import/call、ScenePreview 仅0006资源资格与按mapId库路径、专属 source/browser/render 校验。SceneCastleVisual、presentation、受损特效与主生命周期复用现实现。主线拥有 mode1/map6 Castle 原身份/HP和权威事务资格，FX拥有普通受损状态消费者。

| 原身份 | 型号 | 原position | INI动作顺序 | n1/n2时长 |
| --- | --- | --- | --- | --- |
| 81 | obj05449 | [-1.769619,0,-1718.175903] | c2,c1,c3,n1,n2 | 1921ms |
| 82 | obj05450 | [-39.410892,0,1728.126831] | c1,c2,c3,n1,n2 | 1921ms |

05449 c1为1921ms，c2/c3为16001ms；05450 c1为1921ms，c2/c3为16001ms。十动作保留原 position/matrix/bounds/时长/完整 tracks/tags 与原文件引用，全部有五条命名 tag_spout1..5 轨道。未按 INI 序号猜动作或挂点。

`tests/scene-castle06-source.py` 和 `scene-castle06-source.json/.log` PASS：两原CAS放置、INI五动作顺序、十MV3完整帧XYZ/UV/morph、原材质17float、原DDS解码像素及全部挂点矩阵逐值相同。既有GLB直接复用，未重复批量导出。

## 普通玩家证据

- `browser-scene-castle06-2026-10-04T16-13-57-694Z.json`：正常React选择mode1/map6、建房、卡片加入、两CPU、Ready。双端82 n1实际提交绘制；两Castle十action roots中各仅n1启用。普通Leave后 Castle instances/roots/meshes均0；新房普通重入两Castle stage2/mask0/n1；最终Leave三0。routeInputs为0，不称普通移动已验。
- `browser-scene-castle06-2026-10-04T16-16-32-307Z.json`：限定补81近处段。130组普通A/D/W输入，双方靠近原81至750范围，原n1实际提交绘制及源XYZ/UV/纹理/材质/world matrix一致；Leave三0。本段未重复重入。
- 两段各有 `-natural-1/2.png`。原围墙遮挡Castle，双端81近图未能独立确认可辨建筑像素。绘制调用不能代替玩家可见输出。

`scene-castle06-actual.json` 和 `scene-castle06-near81-actual.json` 标为 `PASS_RENDER_LIFECYCLE`、`visibleOutputAccepted:false`。`scene-castle06-web-types.log`通过；`scene-castle06-process-cleanup.json`记录3328/5358/9558端口关闭、server/chrome关闭与临时目录释放。

## 未完成范围与原位建议

M3-08-CASTLE06如无对应项由主线登记，保持玩家表现完成条件未勾。有效范围为原资源/正式模型消费者/普通81移动和双端渲染/两原模型入场状态/Leave重入清理；不是无遮挡建筑输出、普通受损/死亡、Castle碰撞规则、完整地图或高清性能PASS。原02的动作/挂点/native消费者证据直接复用。

玩家可见缺口入口为原围墙遮挡后的普通合法接近路线与FX首次81受损画面。两现raw、PNG与cleanup保留，地图线停止第三次同类可见性补验；FX首次新受损输出可与本片组合。主线负责权威资格与tasklist集成勾选，地图线不改伤害政策。

## 81普通受损可见组合

FX提供 `browser-combat-castle06-2026-10-04T16-23-28-069Z.json` PASS：单射手32次双端同值普通Castle事务，将原81从HP2000降至624；普通NAV绕墙后，两端c2实际60/59次绘制。完整 `-low-1/2.png` 可辨原庭院红瓦城堡、门/墙和受损烟火，原树/围墙未遮住主体；本线已审这两图。`castle06-composed-evidence.json` 与 `scene-castle06-consumer-scope.md`引用本线原资源、startup/清理和FX新状态段。先前startup摘要的visibleOutputAccepted:false仍保留，普通c2可见资格来自本新状态段，不改旧证据边界。

主线可按此组合登记限定81普通受损模型可见与双端状态/清理范围。82普通受损、死亡、全声音资格、地图完整行为与高清仍未完成；不重复第三次startup可见性取证。
