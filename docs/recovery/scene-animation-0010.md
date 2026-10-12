# 0010 General106原CVD环境动画

原0010 General106的obj05015已接正式CVD场景消费者。普通mode1双001、两CPU和Ready实战中，双端实际提交两个原节点：节点0保持原固定姿态，节点1沿原旋转和缩放轨道变化。全部世界空间XYZ、UV、indices及源矩阵重算误差0；短普通Leave、重入和再Leave六资源计数归零。

## 原资源与放置

原`Data/scnobj/obj05015/obj05015.CVD`两个节点均有几何、parent=null，分别48/20三角形，共68。各37个原顶点帧、duration6秒，帧内容逐帧完全相同，局部顶点没有动画变化。节点0position1key/rotation37key/scale1key的值全部恒定；节点1position1key恒定、rotation37key与scale35key变化。表现运动来自节点1原轨道，不能把37个相同顶点帧称为顶点动画运动。

原材质引用均`obj05015.tga`；独立`export_scene_animation_0010.py`从同目录`obj05015.dds`解码发布PNG，以原CVD材质字节、GBF状态、节点parent/frames/times/tracks/indices发布`scene-animation-0010.json`。没有借用obj05025纹理或声音。`scene-animation-0010-source.json/.log`逐值核原资源与发布资源、decodedRGBA像素、两节点局部帧恒定与原轨道变化，PASS。

原`Data/scn/0010/0010.obj`General106为enabled1/modelobj05015，position(−83.647163,332,−70.740120)，rotationY89.5°，bounds(346.661499,346.661499,125.204941)。26字节tail公共778346a2/derived778344ad，field5c=1，其他string/flags为空或0，没有声音或效果名；此数值没有用于猜测动画rate或添加声音。

原matrix线性部分为89.5°旋转，translation包围中心(−123.336838,331.923065,−70.999138)。正式ScenePreview沿已有明确合同保留线性部分、用原position替换translation；原raw与正式placement矩阵分别保存。CVD源节点矩阵与placement已作用到提交顶点，Web反射X，Babylon mesh worldMatrix保持identity。

`export_scenes.py`新增独立05015导出调用，仅0010/id106添加animation引用。现SceneCvdAnimation与原匹配samplers不修改；其他源字段保持原值，root字段审查PASS。0003/id146同源资源取证保留，但原现玩法MAPS没有map3普通建房资格，0003没有正式animation映射、未提供viewer或fixture资格。

## 双端实际绘制

接受`browser-scene-animation-0010-2026-10-04T02-50-33-449Z.json`中已保存的真实绘制段：普通mode1/0010双001、两个CPU、Ready、正常托管移动后取消托管，按实际world位置用A/D转向原物件，必要时普通W。routeInputs保存真实player坐标/yaw/tick/keys，未写玩家、相机、clock、HP或通知。

| 网页 | 固定节点0实际draw | 动态节点1实际draw | 保存世界姿态0/1 | 同帧双节点capture |
| --- | --- | --- | --- | --- |
| 1 | 6 | 1058 | 1 / 3 | frame125 |
| 2 | 7 | 582 | 1 / 3 | frame90 |

每端capture均含同帧两个原source节点与原05015纹理；固定节点按原不变矩阵核验，动态节点三个实际clock对应不同原轨道矩阵和世界XYZ。`tests/scene-animation-0010-actual.cts`逐draw按真实clock采原rotation/scale、原37相同顶点帧，重算placement到世界坐标全部XYZ、UV与indices，最大矩阵/位置误差均0。

`scene-animation-0010-accepted-1.png`与`-2.png`直接由两个实际canvas capture保存，软件画布320×180。原物件位于332高度，普通视线中的模型尺度较小；截图与source draw metadata一起用于来源资格，不宣称近景细节或像素对照。

## 普通生命周期与证据索引

`browser-scene-animation-0010-2026-10-04T02-57-08-807Z.json`为独立短`--lifecycle-only`PASS：普通双端mode1/0010、两CPU与Ready后立即Leave；六计数动画实例/源mesh/源纹理/effect instances/scene voices/battle voices全部0。正常新房双端重入各一动画实例、两个原mesh、一专属纹理，再Leave六计数归零。此段不执行视野gate或托管，不重复长局。

当前验收脚本在WAITING用正式等待房间关闭入口、PLAYING用Leave。独立`scene-animation-0010-process-cleanup.json`核3306/5336/9536无监听、专属临时目录无残留。

| 产物 | 接受范围 |
| --- | --- |
| `scene-animation-0010-source.json/.log` | 原CVD/DDS/placement与发布资源，源固定/动态轨道 |
| `browser-scene-animation-0010-2026-10-04T02-50-33-449Z.json` | 原整体FAIL保留；独立接受两端已完成source draw/capture段 |
| `browser-scene-animation-0010-2026-10-04T02-52-48-912Z.json` | 整体FAIL保留；不作为最终绘制或生命周期资格 |
| `browser-scene-animation-0010-2026-10-04T02-55-17-029Z.json` | 整体FAIL保留；首Leave/重入成功范围保存 |
| `browser-scene-animation-0010-2026-10-04T02-57-08-807Z.json` | 独立短生命周期完整PASS |
| `scene-animation-0010-actual.json/.log` | 双参数独立核原有效绘制段与短生命周期，PASS |

完整原FAIL状态均未覆盖，独立资格只接受完成的实际来源/绘制及最终完整短生命周期。统一Web构建由root执行。

## 限制

原General完整start/phase调度未恢复；入图start0、rate1、网页独立相位继承Web明确约定。raw包围中心matrix平移与正式position平移分别列明。实际draw与原几何重算不证明原GPU像素或高清性能；0003原未开放普通资格、完整原NAV与其他05018资源不由本片关闭。
