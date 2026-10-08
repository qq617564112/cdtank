# 原战车 toon 光照运行时

普通战车组件在原0001–0025地图消费原`data/image/toon/0.bmp`、默认灯位置`[0,200,0]`与角色中心到灯的方向。现有“卡通渲染”显示偏好开启时使用原toon采样，关闭时使用现普通MV3光照；动作切换、异步加载与迷彩仍沿既有TankView生命周期。

## 原来源

三部件渲染入口`4695bf`与四部件入口`46cec7`读取`635830` manager的`virtual+34`。manager由`45552d`构造，vtable为`5c6c48`，`+34`指向`44f081`，直接返回manager`+94`布尔。原INI读取`41d2a2–41d2bc`将`[Display] Silhouette`写到settings`+210`，默认1；`454ef3–454f03`按非零布尔写入manager`+94`。三部件`469726`与四部件`46d02e`分别压入`0x1000`，随后`46970a/46d012`调用`GetRenderEffect`，再经各组件`virtual+10`提交真实effect。该slot对应`gbActor::Attach`，把effect传至`1000d570`的非空显式effect分支；原注册`100272be`将`0x1000`绑定`cartoon.gbf`。

原渲染另有scene`+2c==1`时选择`0x1010`／`0x11`的分支，分别属于带雾toon与普通材质。`45a4cb`读取地图INI的`[fog] enable`，`45a764`把非零布尔写入scene`+2c`。原25份同名地图INI均为`enable=0`；0016的`density=.12`不改变其关闭资格。当前图级环境同样关闭雾，生产消费`0x1000`分支。Web的显示偏好保存沿既有本机存储合同。静态原入口与逐图字段见`scene-actor-toon-render-source.json`。

原25份`Data/scn/0001..0025/*.ctl`各为4字节`00000000`，均沿零候选默认对象分支。场景加载`45b4e4–45b536`创建默认SYcToonLight、加载资源名`0`并写位置`[0,200,0]`；`46400c`按`data/image/toon/%s.bmp`读取原纹理。原BMP为128×2、24位RGB。

三部件`46a26b`与四部件`46d756`的零候选更新将默认灯与角色中心变换到同一视空间，再以灯减角色中心归一化，提交`SetLight(mode1,direction,texture)`。既有`scene-actor-default-light-native.json/.log`的12组更新／42次组件保存只覆盖已记录的方向与保存合同。本批复用该范围；25图ctl和普通effect入口来自静态原文件及原指令。

`cartoon.gbf`在顶点阶段计算`max(dot(normalize(normal*mv),lightdir),0)`与固定纹理V=1，片段阶段以POINT、无mip、CLAMP采样toon纹理，再乘源材质颜色与本体纹理。原rigid view旋转保持点积；Web按转换后的世界法线与同一角色中心方向计算，保留native X取负的坐标转换与NORMAL morph。

## 发布与生产消费者

`recovery/export_scene_actor_toon.py`定向读取原ctl与BMP，发布`scene-actor-toon.json`及`scene/actor-toon/0.png`。PNG保持原128×2像素；metadata记录25图零候选资格、原灯位置与纹理路径。非零ctl不采用默认对象，不推断多候选权重。

ScenePreview持有图级toon纹理owner，加载、失败、迟完成、clear及scene释放共享同一资源所有权。TankView的真实U/M/X/Y组件借用图级纹理，按统一角色中心计算方向，材质绑定时读取当前显示偏好。开启toon时不叠加现采用的sceneLight，关闭时继续普通MV3路径；已有本体纹理、UV、动画、透明与迷彩政策保持。

## 限制

普通几何`gbGeomNode.s_texToon`保持空槽的静态来源已闭合，详scene-geometry-toon-source.md；POL/CVD、特效、宠物和地图物件继续沿各自材质入口。美术变体1002经`originalSceneId`映射0002并共用该原输入；原25份ctl资格不变。现Babylon描边、透明／alpha拒绝和图级ambient继续采用已登记Web政策；原非零ctl权重、带雾toon与完整D3D设备像素等价仍开放。

本批已完成一次集中静态走查，未运行测试、浏览器、构建、类型检查或native取证。资源已实际发布，新增普通对局、双端、设置切换、清理及高清表现尚待实测；M3-03、M4-07、M5-14/UI-50和M7完整父项保持未勾。
