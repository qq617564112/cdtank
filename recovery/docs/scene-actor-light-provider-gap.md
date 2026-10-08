# 原角色选灯与几何 toon 来源边界

M3-03/M4-07。普通角色的显式effect调用方、Silhouette显示门禁、原25图默认灯与toon纹理已接入生产，详[原战车toon运行时](scene-actor-toon-runtime.md)。原`scene-actor-light-provider-source.json`、`scene-actor-default-light-native.json`和`scene-actor-toon-render-source.json`分别保留字段、有限方向执行与静态角色选择来源。

## 原角色默认灯

三部件`46a571/46a580/46a58f`与四部件`46da60/46da6f/46da7e/46da8d`通过`5c0a04`调用`gbActor::SetLight`。`100099b0–100099e2`保存mode至actor`+94`、方向至`+98/9c/a0`、纹理至`+a4`。

场景`+1a8`为八字节候选记录vector。`45b70e/45b751`按原`.ctl`字符串调用`45b3ea`读取数量，kind0创建对象、kind1复制既有索引。原0001–0025各图ctl均为4字节零数量，角色沿零候选分支读取scene`+70`默认对象。

`45b4e4–45b536`创建默认SYcToonLight，资源名为`0`，原`46400c`按`data/image/toon/%s.bmp`加载`0.bmp`，位置为`[0,200,0]`。原BMP为822字节、128×2、24位RGB。角色把灯位置和自身`+28`位置变换到同一视空间，以灯减角色位置归一化，再提交上述SetLight。

既有零候选原执行保存12组更新、42次组件提交，覆盖不同角色位置、rigid view变换及scene清除；清除写回mode0、零方向和零纹理。其场景、对象、矩阵和纹理handle仍是明确输入夹具，只证明记录范围内的方向与保存合同。

## 普通角色效果选择

角色三部件`4695bf`与四部件`46cec7`的渲染读取manager`635830`的`virtual+34`。其`44f081`返回manager`+94`，`454ef3–454f03`将settings`+210`的非零布尔写到该字段。settings`+210`来自`[Display] Silhouette`，默认1，原INI读取位于`41d2a2–41d2bc`。

门禁开启、雾关闭时，角色请求`GetRenderEffect(0x1000)`；该flags的注册脚本为`cartoon.gbf`。三部件`46974d/46988a/4698af`与四部件`46d051/46d0db/46d33d/46d366`经组件`virtual+10`调用`gbActor::Attach`。`1000a0b0`将显式effect通过模型`virtual+2c`转交`1000daa0`，进入`1000d570`非空effect分支。

scene`+2c`由`45a4cb`读取INI的`[fog] enable`，`45a764`写入非零布尔。原25份同名地图INI均为enable0，生产取无雾`cartoon.gbf`分支；原带雾分支开启toon时选择`0x1010/cartoon_f2.gbf`，关闭时选择`0x11`。

`cartoon.gbf`使用`normalize(normal*mv)`、`max(dot(lightdir,N),0)`及V=1，以POINT、无mip、CLAMP采样texToon。actor render`10009f80`在mode非零、组件`54/58/60`非全有效、显式effect存在且effect`+18`包含`0x1000`时，提交lightdir与texToon。上述角色来源独立于几何静态纹理资格。

## 几何与其它来源边界

原几何selector`10012108–1001211b`仅在`s_texToon`非空、flags不含6或`0x800`时加`0x1000`。静态纹理指针位于`100534b4`，导出名为`gbGeomNode::s_texToon`；随包模块的镜像初值、直接引用、导入、动态解析和生命周期来源证明普通路径保持空，详[普通几何toon资格](scene-geometry-toon-source.md)。后续`_light`材质强制flags`0x4000`，`_water`加`0x8000`，不能由角色Attach链推定几何资格。

原25图ctl均无候选；普通几何自动选择保持空槽资格。非零候选输入不属于这25图来源，完整环境／设备状态与原D3D像素等价仍按对应父项验收。正常角色选择与零候选方向已有来源及正式消费者；美术变体1002经原地图身份映射共用0002的图级输入；其它自定义图保持各自规则。普通对局、双端、设置切换、清理与高清实测尚待完成，相关完整父项保持未勾。
