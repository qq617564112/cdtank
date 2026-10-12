# 逐地图光源与光照核对

原0001–0025的环境、雾与原色资产按已确认的原客户端来源保存。全部3129个地形分片使用原贴图乘顶点色或空纹理的直接顶点色路径。战斗的最终光照使用昼夜、室内和夕阳方向光；坦克与场景共同接收光照和模型软阴影。该视觉增强的配置与生成机制见[ground-contact-shadows.md](ground-contact-shadows.md)。原默认toon灯和查表纹理保留来源记录。

## 原版与当前参数

| 项目 | 原客户端来源 | 当前生产行为 | 核对结果 |
| --- | --- | --- | --- |
| 环境光 | `CDTank.exe`的`0x447c27–0x447c4a`写GfxManager的RGBA `[1,1,1,1]` | `sceneEnvironmentFor`提供RGB `[1,1,1]` | 一致 |
| emissive | 引擎`0x10027fe1`初始化为0 | 全图为0 | 一致 |
| 主地图雾 | 25份`Data/scn/<id>/<id>.ini`的enable、start、end、RGB均0；0016的density为0.12，其余为0 | 雾关闭，0016保留float32的0.12 | 一致 |
| 战车toon候选 | 25份同名CTL均为4字节`00000000` | metadata逐图记录candidateCount=0 | 一致 |
| 默认战车toon灯 | `0x45b4e4–0x45b536`加载资源名`0`、位置`[0,200,0]` | 原参数保存在来源资源；战斗使用地图方向光 | 战斗采用场景光照 |
| 地图附加灯 | 所查游戏主地图加载链没有找到普通场景灯的生产调用 | 原输入`lights: []`；战斗另有统一方向光 | 原输入一致，最终光照为视觉增强 |
| 战车toon查表颜色 | `Data/image/toon/0.bmp`，128×2，两行相同、两种RGB | 当前`scene/actor-toon/0.webp`，128×2，无损编码 | 一致 |
| 地形颜色 | 25份POL均为FVF21，使用原packed顶点RGBA | 3129个GLB分片的顶点色逐值保留；全部进入原材质路径 | 输入与材质路径一致 |

原环境光写入、逐图INI／CTL字段与原shader正文见[scene-client-colour-lighting-source.json](../../recovery/output/scene-client-colour-lighting-source.json)。角色默认灯和显式toon入口见[scene-actor-toon-render-source.json](../../recovery/output/scene-actor-toon-render-source.json)；已取得的原生方向记录见[scene-actor-default-light-native.json](../../recovery/output/scene-actor-default-light-native.json)。

原主地图配置加载入口为`0x45a4c1–0x45a9c5`，对象／CTL等加载入口为`0x45b4b6–0x45bb69`。25份OBJ中的类别为Breach、Plant、Sound、General、Crush、Effect、Sequence、Hook、WaterFall，没有独立灯对象类别。引擎另有`gbLoadLightFile`（`0x10017200`）及`gbVolModNode`的Attach／AddVolModNode链，但所附EXE没有导入这些入口，所查实际地图加载链也未进入它们。CTL的零候选只说明toon灯资格，附加灯结论同时依赖游戏加载链与实际放置资源。

模型名中的`_light`表示发光绘制用途：原`gbGeomNode::AttachSelf`的`0x10012121–0x1001213d`按该名称设置flag `0x4000`，`0x10027302`将其关联到`light_effect.gbf`。该脚本使用纹理乘ambient和`SRCALPHA/ONE`叠加，没有给周围模型计算照明。发光贴片不能计作一盏场景灯。

## 每张地图

“基础参数一致”指原输入的环境光、emissive和雾。最终画面使用上文的统一场景光照；地形覆盖数指已登记原kind0／kind1材质的分片数／原POL总分片数。地图名称取原gamestring的`ID=629+mapId`。

| 地图 | 原名称 | 基础参数 | 原地形材质覆盖 | 其他问题 |
| --- | --- | --- | ---: | --- |
| 0001 | 不毛岛 | 一致 | 85/85 | — |
| 0002 | 田野路 | 一致 | 76/76 | — |
| 0003 | 蛋糕南路 | 一致 | 90/90 | — |
| 0004 | 早安一路 | 一致 | 150/150 | — |
| 0005 | 不是约翰的路幽浮 | 一致 | 124/124 | — |
| 0006 | 仙剑岛庭院大战 | 一致 | 125/125 | — |
| 0007 | 木桶广场 | 一致 | 56/56 | — |
| 0008 | 废弃魔王路 | 一致 | 221/221 | — |
| 0009 | 秘密工厂迷宫 | 一致 | 32/32 | 两处采用跨目录同名纹理 |
| 0010 | 夕阳蛋糕南路 | 一致 | 112/112 | — |
| 0011 | 约翰的路 | 一致 | 118/118 | — |
| 0012 | 不是约翰的路田园 | 一致 | 104/104 | — |
| 0013 | 凄凉魔王路 | 一致 | 224/224 | — |
| 0014 | 田野路南瓜田 | 一致 | 47/47 | — |
| 0015 | 秘密工厂仓库 | 一致 | 29/29 | — |
| 0016 | 仙剑岛秘密仙境 | 一致；雾仍关闭 | 97/97 | 一处采用同图替代纹理 |
| 0017 | 魔王山迷宫 | 一致 | 120/120 | — |
| 0018 | 血战秘密工厂 | 一致 | 21/21 | — |
| 0019 | 田野路南瓜大丰收 | 一致 | 160/160 | — |
| 0020 | 阴森魔王路 | 一致 | 190/190 | — |
| 0021 | 木桶广场击破赛 | 一致 | 104/104 | — |
| 0022 | 魔王山宝藏 | 一致 | 72/72 | — |
| 0023 | 春节版仙剑岛 | 一致 | 159/159 | 两处采用跨目录同名纹理 |
| 0024 | 圣诞节版魔王山 | 一致 | 222/222 | — |
| 0025 | 情人节版早安公园 | 一致 | 391/391 | — |

以上25图共3129个地形分片。原POL的packed顶点色转float32后，与发布GLB的COLOR_0逐值一致，没有发现顶点色丢失。已登记分片的原色路径使用贴图乘原RGBA；新增场景光源和阴影在原色之后独立叠加。所查有资产的Breach、General、Crush、Plant静态放置均有相应原材质登记。

1001为自制地图，没有原客户端对应地图可核对，环境资格为custom。

## 共用卡通明暗纹理

原BMP的前18列RGB为`[166,175,179]`，其余110列为`[238,238,238]`，两行相同。它决定原客户端战车表面的两档明暗。

当前资源由`apps/web/public/scene-actor-toon.json`指向`scene/actor-toon/0.webp`。该图为128×2无损编码，与原两行的RGB及分界一致。`actor-toon.ts`使用NEAREST与CLAMP，`mv3-material.ts`固定在V=1采样，保留原两档查色。当前战斗材质消费统一场景光照，不采样该表；卡通描边独立保留。

## 0004、0021的五个材质分片

| 地图 | 分片 | 原kind | 原首纹理 | 面数 | 原材质diffuse RGB |
| --- | --- | ---: | --- | ---: | --- |
| 0004 | box2162/3 | 0 | 空 | 11 | 0.58431375/0.58431375/0.58431375 |
| 0004 | line589/3 | 0 | 空 | 8 | 0.46666670/0.46666670/0.46666670 |
| 0004 | line590/3 | 0 | 空 | 8 | 0.46666670/0.46666670/0.46666670 |
| 0004 | box2172/3 | 0 | 空 | 11 | 0.58431375/0.58431375/0.58431375 |
| 0021 | plane04/0 | 0 | 空 | 2 | 0.58431375/0.58431375/0.58431375 |

两个定向publisher登记全部150／104个分片，空首纹理以`texture: ''`表达。`geom_c1.gbf`关闭Lighting，COLORARG1为TEXTURE、COLORARG2为CURRENT。D3D9的[Texture Blending](https://learn.microsoft.com/en-us/windows/win32/direct3d9/texture-blending)规定：COLORARG1为TEXTURE且纹理指针为NULL时，当前及后续纹理阶段不处理，因此保留FVF21的顶点色。

`SceneTerrainMaterial`的无SOURCE_TEXTURE分支直接输出原RGBA。全部地形使用原自定义shader，不消费战斗`scene-runtime.ts`中方向`[0,1,0]`、intensity `1.2`、groundColor `[0.35,0.35,0.35]`的Babylon半球光，也不乘GLB的PBR baseColorFactor。

来源为[export_scene_terrain04_material.py](../../tools/recovery/export_scene_terrain04_material.py)、[export_scene_terrain21_material.py](../../tools/recovery/export_scene_terrain21_material.py)、发布材质JSON及对应GLB。运行时见[scene-terrain-material.ts](../../apps/web/src/assets/scenes/scene-terrain-material.ts)和[scene-runtime.ts](../../apps/web/src/render/scene-runtime.ts)。

## 三图纹理采用

0009的材质26／30将`00026.tga`映射到`Data/map/0015/00026.dds`；0016的材质33将`ct-01-1.tga`映射到`Data/map/0016/di2.dds`；0023的材质32／134将`qiao.tga`映射到`Data/map/0006/qiao.dds`。清单见发布的`scene-terrain-texture-adoptions.json`。

这五处属于贴图来源限制，不是灯参数差异。0016为明确的同图替代，跨目录同名的另外四处也尚未证明原搜索路径。即使光照参数一致，这些位置也不能认定颜色完全还原。

## 限制

来源核对覆盖所附EXE／DLL、25图原INI／CTL／OBJ／POL、发布GLB／材质记录、实际查表纹理及当前运行时代码。实现未执行测试、浏览器验收、构建或类型检查，也没有取得25图逐图原生GPU画面对照。既有原生toon方向记录只覆盖其已记录范围。最终设备状态、纹理过滤、描边与高清美术的像素等价不由本次静态核对证明。
