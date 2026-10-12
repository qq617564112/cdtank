# 0018 General66–69原CVD环境动画

原0018四个General的obj05018已接正式CVD场景消费者。普通mode4双001、两CPU、Ready实战中，双端66号点实际提交全部五个原几何节点：静态节点0保持源姿态，动态节点2–5各采得三个不同世界姿态。四个owner的来源矩阵及完整六节点链均核验通过；普通离房、重入和再次离房资源清空通过。

## 原资源与放置

`Data/scnobj/obj05018/obj05018.CVD`共六节点。节点1为空根，无几何与动画；动态节点2–5均以1为父。节点0为独立根，60三角形；节点2–5各12三角形，总108。五个几何节点各四个原顶点帧，局部XYZ逐帧完全相同，duration0.5秒。节点0position/rotation/scale值恒定；节点2–5三类轨道各四个不同值。世界运动来自源轨道，不来自局部顶点帧变化。

独立`export_scene_animation_0018.py`发布原parent、frames、times、tracks、indices、材质17个数值与GBF状态，仅从原同目录DDS解码05018 PNG。source校验对比原CVD字段、parts完整数量、duration、原DDS decodedRGBA及四放置字段，PASS。

| 原0018 ID | 原position XYZ | 原Y旋转 |
| --- | --- | --- |
| 66 | 272.762939, 156, 1267.031860 | 180° |
| 67 | −319.609192, 153, 1269.375854 | 180° |
| 68 | −321.701355, 155, −1199.895020 | 0° |
| 69 | 270.450989, 157, −1197.547241 | 0° |

四记录均enabled1、SYcScnObjGeneral、modelobj05018。tail26字节公共778346a2/derived778344ad，其余名称和flags为空或0，没有来源声音名称。`export_scenes.py`仅为0018/66–69增加独立animation引用。原raw matrix保留；正式placement遵循ScenePreview合同，保留原线性部分并用原position替换包围中心translation。源节点矩阵与placement先作用于顶点，Web反射X，Babylon mesh worldMatrix为identity。

## 普通双端来源绘制与生命周期

`browser-scene-animation-0018-2026-10-04T03-08-56-472Z.json`保存普通mode4/0018、双001、两个CPU、Ready和正常托管后取消托管的绘制。66号点两端均有五geometry同帧capture；静态0三clock对应一个固定世界姿态，动态2–5各三clock、三源矩阵及三世界XYZ姿态。四owner各六节点/五geometry、完整parent空节点链和formal matrix分别核验。其他记录绘制按其实际采样范围保存。

`tests/scene-animation-0018-actual.cts`逐记录draw与capture，按真实clock重建原六节点父链，核全部提交XYZ、UV、indices、原05018纹理与identity mesh矩阵，最大矩阵与位置误差为0。首加载320×180 PNG用于source draw消费者资格。

近景普通输入限定75秒，目标66、PLAYING、距离小于550且同帧五geometry；`browser-scene-animation-0018-2026-10-04T03-11-55-876Z.json`未获得合格近景capture。两端均死亡重生四次；host最近距离562，guest最近455，guest在(−461.57,−344.47)附近受碰撞停滞。该窗口不用于近景视觉资格。

`browser-scene-animation-0018-2026-10-04T03-16-02-093Z.json`记录20秒限定普通PLAYING朝向补段；两端1280×720截图包含正常地图与坦克。host67/frame164/tick244与guest66/frame69/tick32各有同帧五source geometry提交，但源物件受墙体遮挡与距离影响，PNG未形成可识别完整05018的视觉资格。`scene-animation-0018-visual-review.json`独立接受范围为NOT_ACCEPTED，observer gate PASS不表示视觉完成。

独立短`--lifecycle-only`输出`browser-scene-animation-0018-2026-10-04T03-10-02-088Z.json` PASS：正式Leave后两端动画实例、source meshes、source textures、effects instances、scene voices、battle voices六计数均0；普通新房重入各4动画、20几何mesh、4纹理，再关闭等待房间后六计数均0。

| 产物 | 接受范围 |
| --- | --- |
| `scene-animation-0018-source.json` | 六源节点、材质、DDS、四placement，PASS |
| `scene-animation-0018-root-fields-review.json` | 原2235记录字段与四animation限定映射 |
| `browser-scene-animation-0018-2026-10-04T03-08-56-472Z.json` | 原整体状态保存；独立接受有效双端来源绘制段 |
| `browser-scene-animation-0018-2026-10-04T03-10-02-088Z.json` | 普通双端离房、重入、最终清理PASS |
| `browser-scene-animation-0018-2026-10-04T03-11-55-876Z.json` | 普通近景碰撞与重生阻塞，近景未验 |
| `scene-animation-0018-visual-review.json` | PLAYING1280×720图像审查；可识别视觉未验 |
| `scene-animation-0018-actual.json` | source draw重算与短生命周期独立PASS |

## 主线69双端普通路线视觉接线

root专属`tests/browser-scene-animation-0018-route.mjs`使用正式原49×52 NAV footprint与BOX26纯路线检查，显式页面焦点/普通W/A/D短按释放；不写玩家位置、相机、HP或时钟。取样资格依据同帧实际camera view/projection投影69五geometry，不把snapshot lookyaw猜成render camera。`browser-scene-animation-0018-route-2026-10-04T03-34-13-354Z.json`普通PLAYING双端PASS：hostframe173/tick322、guest93/tick191，1280×720原物件在墙上可识别，实际投影67.464×47.162与35.378×22.917。

独立route-actual将03-19-19与03-34-13有效原draw合并，逐原父链/XYZ/UV/indices/纹理/clock matrices误差0；host动态各5pose、guest各6，static0一pose。新host本身仅两pose，未擅称三。每pose与visual都有独立raw/frame/clock，完整新相机矩阵与源候选PNG/原像素裁剪对应；source-visible-review、root-final-verifier及root-integrated通过，lifecycle复用03-10-02的双端普通离房重入PASS。

原03-19-19单端及03-28-26 footprint/pulse整体FAIL保留，最终针对真实输入、原占用及实际相机取样修复后通过，不反复跑相同gate。专用端口与tmp清理见route-final-cleanup。通过仅关闭M3-05-0018-ROUTE/placement69；66–68完整可识别视觉及原General启动/GPU/HD性能仍未闭，M3-05-0018母项保持未勾。

## 限制

General原start/phase调度未恢复；start0、rate1、网页独立相位是Web约定。首加载PNG中的原物件尺度小，只证明真实draw消费者，不能证明近景可识别视觉、原GPU像素或高清性能。四位置完整近景视觉与原完整启动父项保留待验。
