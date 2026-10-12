# 0007 原 CVD 环境动画

M3-05-0007：PASS。正式地图 0007 的 General 实例 32 现在使用原 `obj05025.CVD` 的三个几何节点、原节点变换、顶点动画和 DDS 纹理，随正式 `Battle.render` 自然更新。两个当前 React 网页在普通 CPU 战斗中完成实际绘制、普通移动转向后的可见性、自然循环、退出和重新入图清理。

## 来源与正式接线

| 层 | 结果 |
| --- | --- |
| 原场景来源 | `Data/scn/0007/0007.obj` 的 `SYcScnObjGeneral` 实例 32，model=`obj05025`，几何原点 `[-392.4166564941406,0,402.904296875]`，原矩阵旋转 334.5°。模型与纹理均有实物。 |
| 原资源 | `Data/scnobj/obj05025/obj05025.CVD` 的 23 节点中三个有几何，各 11 帧，末帧时间 1.6666666269302368 秒；其余 20 个无几何节点保留 parent 与空 parts，不补动画。原纹理 `obj05025.dds` 同目录发布 PNG。 |
| 资源模块 | `export_scenes.py` 正式调用 `export_scene_animation_0007.py`，从原 CVD/DDS/GBF 直接发布 `scene-animation-0007.json` 和 PNG，再给实例 32 添加明确 animation 引用。不依赖 `effect-models.json` 缓存。 |
| 正式绘制 | `SceneCvdAnimation` 复用原 `EffectModelAnimation`、`effectModelVertices` 与模型材质/绘制组件，使用原 placement 线性变换及独立 position 替换包围中心平移。网格使用 `sourceSceneModel`、原节点序号和实例 ID 元数据。 |
| 实战调用 | `ScenePreview.load` 创建资源，`ScenePreview.advance(deltaSeconds)` 由 `Battle.render` 每帧调用。网络快照刷新不驱动 CVD 时间。`ScenePreview.clear` 与 scene 终端释放动画、模型网格、材质和纹理，并隔离已取消的异步加载。 |

原 CVD 的节点变换与局部几何分别采样；三个已有 morph-only GLB channel 不代替原节点轨道。普通静态资源仍按已有缓存实例化。三个有几何的 CVD 节点使用源 mode3 位置、四元数旋转和缩放轨道；XYZ、UV 与法线采样、严格超过 duration 才循环、engine delta≥0.5 秒返回 0.1 秒，复用已有原 gbGeomNode/gbAnimatedMesh 指令对照组件。

## 双端普通战斗结果

专属服务端 3271、Vite 5301、CDP 9501。两独立账号使用完整原角色源，在普通建房、加入、CPU、Ready、W 移动、Space 开火及 A 转向流程中运行。Vite 依赖缓存位于专属临时目录。

| 观测 | 网页 1 | 网页 2 |
| --- | --- | --- |
| 原三节点实际 `onBeforeRender` 提交 | 每节点 73 次 | 每节点 63 次 |
| 自然循环次数 | 三节点各 3 次 | 三节点各 3 次 |
| 原纹理与来源元数据 | 三节点逐帧保持 | 三节点逐帧保持 |
| 普通 W 前后玩家位置 | P1：(182.31,420.93)→(-150.22,329.01) | P3：(541.14,422.02)→(203.06,353.26) |
| 普通 A 入镜时角色 yaw | -1.2026 | -1.4712 |
| 屏内目标区域 RGB 差异像素 | 191，frame 271→272 | 1589，frame 173→174 |
| 内部画布 | 320×180 | 320×180 |
| 记录帧耗时中位数 / P95 / 最大值 | 18.8 / 112.6 / 388.7 ms | 55.7 / 176.5 / 448.6 ms |
| 离房动画 / 网格 / 专属纹理 | 0 / 0 / 0，旧网格 disposed | 0 / 0 / 0，旧网格 disposed |
| 重入后原节点数 / 动画实例 | 3 / 1，再离房全清 | 3 / 1，再离房全清 |

自然绘制记录包含原三节点实际顶点变化、原纹理 URL 和源实例。可见性先由正常 A 转向将三节点中心投影到画布内部且 depth∈(0,1)，再采两个不同自然帧：第一帧正常绘制，第二帧仅临时隐藏目标三网格，保持原地图、地形、其他物件及相机；在目标投影包围区域比较 RGB，并恢复网格。没有修改 camera、玩家位置、原 placement、材质或时钟。原物件可在截图摊位前的地面区域辨认。

证据：`recovery/output/browser-scene-animation-0007.json`，截图 `browser-scene-animation-0007-1.png`、`browser-scene-animation-0007-2.png`。

## 复现

- `npm run assets:scenes`：正式源生成入口。
- `recovery/.venv/bin/python tests/scene-animation-0007-source.py`：原 23 节点、三几何的完整 frames/tracks/indices、场景引用与 DDS/PNG 像素逐值对照。
- `node --import tsx tests/scene-animation-0007.cts`：原时间边界、三节点动画变化、30 帧实际 renderer 来源元数据保持、释放。
- `node --import tsx tests/browser-scene-animation-0007.mjs`：当前 React 双端普通战斗、可见性与退出重入。

## 限制

入图从零开始、速率 1 及跨网页独立播放相位是 Web 场景播放约定；原 General 完整 start/phase 调度尚未闭合。原轨道、顶点、纹理、节点时钟和循环边界有来源。像素诊断保留其他自然运动，RGB 差异不是完全静止背景下的纯目标像素计数；实际地图遮挡保持。软件渲染及低分辨率画布不证明高清性能。此项只完成 0007 的一个明确原环境动画，不扩展其他地图分类、破坏模型动作或动态碰撞。
