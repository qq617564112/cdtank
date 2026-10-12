# 0021 General170原CVD环境动画

原0021 General170的obj05025已接正式场景CVD消费者。普通双001、两CPU与Ready实战中，两端实际提交三个原几何节点，三组自然顶点姿态、源纹理与世界空间几何逐源一致；Leave和普通重入清理通过。生产变化仅为0021物件的同源动画映射。

## 来源与正式映射

`Data/scn/0021/0021.obj`原170为SYcScnObjGeneral，model obj05025，enabled1、rotation(0,269,0)、bounds(154.085587,198.853897,112.870377)。原position为(−751.904846,0,−970.833923)，26字节tail公共stamp778346a2/derived778344ad、全部string/flags/gain为空或0，无声音或效果名。

原matrix线性部分为269°旋转，translation为包围中心(−753.709839,122.174385,−981.596680)。正式ScenePreview沿已有0007合同保留原线性部分并用position替换translation，供给SceneCvdAnimation；二者分别保存在`scene-animation-0021-actual.json`的sourceRawMatrix与formalPlacementMatrix。Babylon mesh worldMatrix为identity，原节点轨道与placement变换已作用到提交的顶点位置，最后反射Web X。

`export_scenes.py`只将已有obj05025 General映射的限定地图增加0021，引用`scene-animation-0007.json`中的`Data/scnobj/obj05025/obj05025.CVD`同源库。资源名标识既有库，不改变0021地图来源。原170 asset:null由animation引用承担正式模型加载。其他源字段保持原值，root限定字段审查PASS。

原CVD共23节点：前三节点有几何，各11顶点帧，共328三角形；其余20节点无几何，保留parent与空parts，无动画轨道。三个几何节点各position1key、rotation11key、scale1key；每条轨道的原key值完全相同，九条源变换轨道均恒定。实际运动来自原11帧XYZ顶点动画与自然时钟，不能把恒定源变换宣称为旋转轨道变化。

`scene-animation-0021-source.json/.log`为PASS：原放置字段、26字节tail、23节点parent、三几何全部frames/times/tracks/indices逐值对应发布资源；九条恒定轨道值与20空节点明确验证。原DDS与发布PNG decodedRGBA像素相同。资源导出与消费者复用已恢复0007 CVD/DDS模块，没有新声音、资源替代或动画调度。

## 普通双端实战

`browser-scene-animation-0021-2026-10-04T02-41-46-467Z.json`与`browser-scene-animation-0021-run2.log`完整PASS。普通mode5/0021双001、两个CPU、双方Ready；正常autopilot按钮移动后取消托管，再以真实KeyD转向原物件，十条实际routeInputs包含玩家位置、yaw、tick及keys。未写position/相机/clock/HP/通知。

主端P1保持(−304.71,−1119.34)，正常KeyD将yaw从−5.7596转至−7.4396入镜；客端P4经普通托管从同初始位置移至(−363.83,−1059.76)，KeyD将yaw从−7.0782转至−7.6062。无需W越过源障碍、修改NAV或改变视角参数。

| 网页 | 原节点0/1/2实际draw | 每节点自然顶点姿态 | capture frame | 最大源矩阵/XYZ误差 |
| --- | --- | --- | --- | --- |
| 1 | 8 / 8 / 8 | 3 | 258 | 0 / 0 |
| 2 | 24 / 24 / 22 | 3 | 169 | 0 / 0 |

`tests/scene-animation-0021-actual.cts`按实际clock对原轨道重采样，以23节点parent链、正式placementMatrix与原11帧顶点采样逐draw计算全部提交XYZ、UV和indices；源矩阵与世界空间XYZ误差0，纹理均为`Data/scnobj/obj05025/obj05025.png`，三个mesh均保持原sourceSceneModel/sourceNode/placement170。每节点原clock变化、顶点姿态三组不同，源变换矩阵恒定符合原九条轨道。

`scene-animation-0021-actual.json/.log`为PASS。`scene-animation-0021-accepted-1.png`、`-2.png`直接由同帧三节点实际绘制后的canvas保存，原地图、正常玩家和独立开火烟光保持；软件画布320×180。

双方普通Leave后动画实例/源mesh/源纹理/effect instances/scene voices/battle voices六计数均0。普通新房双端重入各重新建立一动画实例、三mesh、一专属纹理，再次Leave六计数归零。`scene-animation-0021-process-cleanup.json`核3305/5335/9535无监听、专属临时目录无残留。

## 限制

入图从0开始、rate1与两网页独立相位为继承Web场景播放约定，原General完整start/phase调度未恢复。原matrix包围中心translation与正式position平移消费分别列明；原节点轨道、顶点和纹理有来源。本片证明正常实际draw与源几何，不证明原GPU像素、高清性能或完整原NAV。首托管可见性gate未满足的raw记录保留；最终有效范围以上述普通转向PASS记录为准。
