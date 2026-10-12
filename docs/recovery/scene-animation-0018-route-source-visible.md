# 0018 placement69普通双端来源与可见图像

原0018 placement69的05018已取得普通mode4双001、两CPU、Ready实战中的双端可识别图像。正式NAV/BOX规划只生成普通W/A/D路标，实际相机跟随原玩家；两端同帧提交全部五个原几何节点，实际camera矩阵投影与PNG物件位置一致。完整世界XYZ、UV、indices、原纹理与原轨道矩阵重算误差0，原静态节点保持固定姿态，四个动态节点均有至少三个实际世界姿态资格。普通离房重入复用0018已通过证据。本片关闭69双端视觉，其他三位置完整视觉与原General完整启动父项保持未完成。

## 源资源与独立核验

`tests/scene-animation-0018-route-actual.cts`读取原普通浏览器记录，不改写原JSON。对69号每个draw及同帧capture按真实clock采原CVD position/rotation/scale，保留空父节点1的层级，组合原placement线性部分与position平移；原局部顶点采样后转换世界XYZ并反射X。逐值核全部世界XYZ、UV、indices、原05018纹理、source reference、identity mesh worldMatrix及源clock矩阵。完整六节点/五geometry、四placement来源与DDS像素复用`scene-animation-0018-source.json`。

姿态资格由`browser-scene-animation-0018-route-2026-10-04T03-19-19-578Z.json`与`browser-scene-animation-0018-route-2026-10-04T03-34-13-354Z.json`有效段合并。旧普通路线两端各三个动态姿态；新实际相机记录host两个、guest三个。逐draw独立核算后，四个动态节点合并得到host各五个、guest各六个不同世界姿态；静态0始终只有一个固定姿态，并有反复实际draw。两次记录均为同map18/placement69/原05018/reference/formal matrix，实际clock分别保存，不声称同局同相位或新记录双端各自三姿态。

`scene-animation-0018-route-actual.json`每页`poseEvidence`按节点列出每个姿态的原raw、frame与clock；`visualEvidence`独立列出实际相机截图的原raw、frame及tick。复用段原整体状态保持原值，只接受已完成的具体来源draw段。

## 双端实际图像

实际相机图像来自`browser-scene-animation-0018-route-2026-10-04T03-34-13-354Z.json` PASS，两端PLAYING、1280×720。capture.camera.view/projection、position/target均为正式相机只读记录，五source geometry与canvas在同一实际frame保存。

| 网页 | frame / tick | 原顶点实际投影范围XY | 物件投影尺寸 |
| --- | --- | --- | --- |
| host | 173 / 322 | (619.640,42.098)–(687.103,89.260) | 67.464×47.162像素 |
| guest | 93 / 191 | (621.037,105.313)–(656.415,128.230) | 35.378×22.917像素 |

两端PNG可辨认原05018躯干和翼/旋翼轮廓，位于原砖墙上方；源实际投影候选框与图中物件位置对应。源五个几何节点同帧实际提交，图像接受整个物件可识别轮廓，不要求每个重叠表面分别可见。host图左侧另一物件不由本片关闭其位置视觉资格。

`scene-animation-0018-route-page-1.png`及`-2.png`为原canvas PNG字节。`scene-animation-0018-route-visible-1-candidate.png`裁剪原图(611,34)–(696,98)，`-2-candidate.png`裁剪(613,97)–(665,137)；未放大或重绘原像素。`scene-animation-0018-route-source-visible-review.json`两端人工图像审查PASS，保存完整图、原像素候选裁剪、实际投影范围、poseEvidence及接受边界。

## 普通生命周期与证据

`browser-scene-animation-0018-2026-10-04T03-10-02-088Z.json`为普通mode4/0018双端生命周期PASS：Leave六资源计数均0；普通新房重入各4动画实例、20source mesh、4原纹理；再离房六计数均0。该既有资格复用，不要求为图像补段再跑已通过的生命周期。

| 产物 | 接受范围 |
| --- | --- |
| `scene-animation-0018-source.json` | 六原节点/五geometry/empty1、四placement、材质与DDS，复用PASS |
| `browser-scene-animation-0018-route-2026-10-04T03-19-19-578Z.json` | 两端69真实三姿态来源draw有效段 |
| `browser-scene-animation-0018-route-2026-10-04T03-34-13-354Z.json` | 普通双端69实际相机与可识别PNG，PASS |
| `scene-animation-0018-route-actual.json/.log` | 全draw源重算、静动态姿态与实际相机投影，PASS |
| `scene-animation-0018-route-source-visible-review.json` | 69双端原图及候选裁剪可识别审查，PASS |
| `browser-scene-animation-0018-2026-10-04T03-10-02-088Z.json` | 普通离房、重入及最终资源释放，复用PASS |

## 限制

两网页和两有效段具有独立实际clock，不声称原General调度同相位。start0/rate1仍为Web约定。可识别Web截图不证明原Windows GPU像素一致；69以外三个位置完整视觉与原General完整启动父项未关闭。
