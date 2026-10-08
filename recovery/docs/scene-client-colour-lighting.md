# 原客户端地图颜色与光照参数

0001–0025使用原客户端环境光RGB `[1,1,1]`、emissive `0`、关闭雾效及零toon候选的默认灯。田野路高清1002按其0002源地图使用同一环境与toon参数。地形、普通POL物件和电视屏幕以源贴图乘packed顶点RGBA输出；战车按原Silhouette设置使用toon分层，颜色不叠加额外日光。

## 原始来源

`447bbf/447bc0`调用`gbCreateGraphManager`，`447bc9`将返回对象存入manager `+8`，`447c03`保存同一对象到`63582c`。`447c27–447c4a`用四次`fld1`和四次`movsd`直接把RGBA `[1,1,1,1]`写入该对象`+1a8..+1b4`。`gbGfxManager::SetAmbientLight`的`100033b0–100033d0`使用相同字段。这是游戏创建图形设备时的实际写入，独立于引擎初始化的RGB `0.2`。原emissive初始化为0，复用`mv3-normal-d3d-state-sol-native.json`的既有范围。

`45a6dc–45a7df`按`data/scn/%s/%s.ini`读取主地图配置的fog.enable/end/density/color_r/color_g/color_b并写scene字段。25份主INI的enable、start、end和RGB均0；0016的density为0.12，其余为0。生产表保留该density的float32值，关闭状态不混雾。0016目录中的另名雾效INI不属于此加载路径。

25份同名CTL各为4字节`00000000`。默认toon对象的`45b4e4–45b536`加载资源名`0`并设置`[0,200,0]`；角色使用这一方向和原`0.bmp`，不把该对象改写为带diffuse/attenuation的太阳。原toon启用资格与三／四部件Attach链见`scene-actor-toon-runtime.md`，方向证据复用`scene-actor-default-light-native.json`。

`obj05431`、`obj05424`、`obj05460`、`obj05420`、`obj05459`及`obj05023`主体、scr屏幕的原POL均为FVF21、kind0。七个网格身份由原文件读取；`geom_c1.gbf`明确`Lighting=FALSE`，stage0为TEXTURE乘CURRENT。生产使用这些packed顶点色及原纹理，电视换帧继续替换同一sourceTexture槽。0008中的obj05460被General与Breach共同引用，共用已安装的原opaque材质。

静态提取器`recovery/evidence/render/scene-client-colour-lighting-source.py`保存上述指令、25图原INI/CTL值、七个POL身份与shader正文到`recovery/output/scene-client-colour-lighting-source.json`；它不执行原客户端或Web代码。

## 生产接线

`sceneEnvironmentFor`为原25图和1002提供已确认参数，清图时继续保持游戏环境光白色。地图加载前登记当前环境；MV3绑定把当前ambient同时写入材质缓存与本次effect，避免首次绘制沿用旧值。原toon纹理、源纹理颜色空间修复及声音预解码沿现有实现消费。

General和Crush物件在所有地图按模型身份登记原opaque材质；Sequence主体与屏幕使用相同原POL路径，GLB贴图按编码值直接采样。屏幕克隆材质借用序列帧，清理时释放材质与各自纹理owner。

动态CVD、破损模型和Type5模型在绘制时读取当前场景环境光，使用同一`globalAmbient * materialDiffuse + emissive * materialEmissive`公式；packed顶点色仍由原RGBA决定。源模型目录中的引擎初始化ambient只用于未登记游戏环境的独立查看器。

## 限制

本次依据原文件、静态指令与既有方向证据接线，未运行测试、浏览器、构建、类型检查或原客户端。没有新增原D3D framebuffer逐像素验收；描边、完整设备状态及既有替代纹理的限制仍见各自专题。自制1001地图没有原客户端对应资源，环境标记为custom。
