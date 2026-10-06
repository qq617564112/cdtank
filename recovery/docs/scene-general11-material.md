# General11 原静态材质

地图0011的23条启用 General 记录均为 `obj05431`。原具名类虚表 `5c73d0` 的 loader `4606d3` 优先加载同目录 POL，再尝试 CVD；POL 经 `gbGeomNode.LoadFromFile`。绘制入口 `44dd82` 检查 enabled，压入对象矩阵后调用 `45e9d2`，最终通过 `56f21e` 的真实 import 进入 `gbGeomNode.Attach`。

原 `anangua04` 为 FVF21/kind0，所选 `geom_c1.gbf` 无照明，使用纹理乘 packed diffuse、WRAP、opaque。选择依据复用 terrain02 的原 selector 和完整 gbGeomNode Attach 证据。183个展开顶点的源 UV/RGBA 与发布 GLB 完全相同；本模型颜色均白色。

独立 `SceneGeneralMaterial` 对原缓存资产注册一次，所有放置复用材质。模块使用真实发布 GLB 检查 instance 共用 shader、opaque/WRAP/LINEAR/LESS/write、顶点保留、owner 恢复原材质及释放 shader 保留借用纹理，结果为 PASS_MODULE_ONLY。

顶点 shader 通过 Babylon instancesDeclaration/instancesVertex 读取每次实例 finalWorld，以 viewProjection 投影；两不同放置矩阵模块检查已覆盖该入口。普通首验仪器读取实际 `_processRendering` batch 与 `_draw` 提交，再保存完整自然画布，不将全部23实例登记视为实际可见。

## 未完成范围

正式 ScenePreview 已限定0011 General/obj05431，在缓存解码完成及 revision 有效后注册一次，实例复用原资产；clear 释放 owner。focused Web 类型检查 `scene-general11-material-web-types.log` exit0。来源脚本记录原直接字节和 import 身份，不声称完整 General loader 执行。原 CW culling、GPU 精度、高清及完整地图父项保持开放。

统一工程 `settings-display-general11-production-web-build.log` 类型与发行构建 exit0，dist/release 已同步；本线复用工程结果。

## 普通玩家有限交付

`browser-scene-general11-2026-10-05T03-02-49-562Z.json` PASS：正常 React mode1/map11 四账户入房、Ready、普通 W/A 移动，双端原 anangua04/0 实际硬件实例绘制5/1次，批次保存8个原放置矩阵。两完整1280×720 natural画布已查看，前中景红橙南瓜的原纹理和几何清楚可辨，树遮挡如实保留。双正常 Leave 及最终 ownerfalse/material0，端口3385/5435/9635无监听，进程与临时目录清理通过。索引 `scene-general11-material-player-evidence.json` 待主线审阅。

首02-55-17 raw FAIL 的空绘制捕获与采样早于 Leave 完成保持原记录；独立 observer 同步通知时序检查失败保持原log。来源/module均不代实际像素，不追加第三run。

证据：`scene-general11-material-source.json/.log`、`scene-general11-material-module.json/.log`。归属限独立模块与来源；正式共享接线限 map11 General/obj05431 资产注册和 owner clear。
