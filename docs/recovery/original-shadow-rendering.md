# 原客户端阴影渲染

随项目提供的 `CDTank/CDTank.exe`、`gbengine.dll` 与原 Data 资源中，已确认坦克表面的明暗来自原贴图与 toon 分层着色。没有找到生效的坦克或场景物件投地阴影链。引擎所保留的 shadow-volume 接口在这份发行二进制中为空实现；资源目录存在阴影脚本，不代表游戏实际绘制了这些阴影。

## 坦克表面明暗

普通坦克三／四部件入口 `0x4695bf`、`0x46cec7` 根据 `[Display] Silhouette` 选择原 `cartoon.gbf`。`0x100272be` 将 effect flag `0x1000` 注册到该脚本；带雾分支使用 `0x1010`，原25份主地图 INI 的 fog.enable 均为0。

`Data/gfxscript/cartoon.gbf:27` 将法线变换到视空间，`:33` 计算 `max(dot(lightdir, N), 0)`，`:97` 采样 toon 纹理，`:103–105` 将采样颜色与材质／本体纹理相乘。默认灯来自原零候选 CTL 分支，位置为 `[0,200,0]`；原 `Data/image/toon/0.bmp` 为128×2，两行一致，前18列 RGB 为 `[166,175,179]`，其余110列为 `[238,238,238]`。这是两档表面着色，没有对其他物体的深度或遮挡做采样，不能作为自遮挡阴影或投地阴影的证据。

原入口、默认灯及当前 toon 生命周期见 [scene-actor-toon-runtime.md](scene-actor-toon-runtime.md)。原普通几何材质入口另见 [scene-geometry-toon-source.md](scene-geometry-toon-source.md)。

## 原阴影脚本与二进制消费者

脚本位于 `recovery/output/verified/assets/data/Data/gfxscript/`。

| 资源 | 已确认的脚本机制 | 这份发行版的消费者证据 |
| --- | --- | --- |
| `shadow.gbf` | 第12–14行为 `DESTCOLOR`／`ZERO` 颜色乘法混合、关闭深度写入；第17–20行使用纹理颜色／alpha。适合纹理式压暗，没有 shadow-map 深度比较。 | EXE 在图形系统初始化中载入，未找到实际提交绘制的消费者。 |
| `shadow_F2.gbf` | 带雾的纹理绘制，关闭深度写入，`INVSRCALPHA`／`SRCALPHA` 混合。 | 在所附 EXE／引擎的可读字符串中未找到该路径引用。 |
| `meshshadow1.gbf`、`meshshadow2.gbf` | 第26–51行按法线与光方向判断背光顶点，将其沿 `lightpos * extrudedist` 挤出；第63–92行为两个相反剔除方向的 stencil z-fail `INCRSAT`／`DECRSAT` pass，颜色保持不变。属于几何阴影体。 | 相关引擎排队、计算与基本网格绘制入口为空实现。没有取得生效链。 |
| `skinshadow1.gbf`、`skinshadow2.gbf` | 声明 `bonetm[84]` 并配置两个 stencil z-fail pass；正文没有可确认的蒙皮挤出 vertex shader。 | 没有取得生效链；不能凭名称认定原坦克启用了蒙皮阴影或自阴影。 |
| `shadowquad.gbf` | 第13–21行在 stencil 不等于0处混合颜色，关闭深度测试／写入；与阴影体的压暗覆盖步骤匹配。 | 没有取得生效提交链。 |

### `shadow.gbf` 的实际载入

`CDTank.exe` 的 `0x447a46` 初始化图形系统。断言来源字符串 `0x5c62c8` 为 `…\cdtank\SRrRenderSystem.cpp`，因此可确定这是游戏图形系统的初始化代码。

```asm
00447ca8  mov ecx, [ebx+18h]       ; gbEffectMgr
00447cab  push edi                 ; 0
00447cac  push 005c61ech            ; "data\gfxscript\shadow.gbf"
00447cb4  call [005c0b64h]          ; gbEffectMgr::NewRenderEffect
00447cbc  mov [ebx+34h], eax        ; 保存 effect
```

图形系统构造在 `0x4478cd` 将 `+0x34` 清零。在其方法区间 `0x44726c–0x447d82`，该字段只有构造清零与初始化赋值，没有读取。EXE 中 `shadow.gbf` 路径只有这一个指令引用；对全 EXE 从图形系统全局 `0x635830` 开始的线性寄存器转移查找，也没有找到该对象 `+0x34` 的访问。

这证明脚本载入，尚不证明生成了阴影贴图、取得投影几何、绑定到坦克或提交了绘制。没有据此将它解释成原版已生效的椭圆接地影。

### 阴影体链的空实现

`gbengine.dll` 的导出名提供了接口身份，当前函数正文提供了执行边界。

| 地址 | 原导出 | 正文 |
| --- | --- | --- |
| `0x1001a1d0` | `gbSceneGraph::NewShadowVolume(gbVisNode*)` | `xor eax,eax; ret 4`，返回空，不将阴影体入队。 |
| `0x1000ea90` | `gbBaseMesh::ComputeShadowVolume()` | `ret`。 |
| `0x1000ea80` | `gbBaseMesh::RenderShadowVolume(gbVisNode*,gbRenderInfoObj*)` | `ret 8`。 |
| `0x1001d910` | `gbVisNode::RenderShadowVolume(gbRenderInfoObj*)` | `ret 4`。 |

基本网格虚表中的三处 `ComputeShadowVolume` 指针（`0x1003f554`、`0x1003f5a0`、`0x1003fc84`）均指向 `0x1000ea90`；对应三处 `RenderShadowVolume` 指针（`0x1003f558`、`0x1003f5a4`、`0x1003fc88`）均指向 `0x1000ea80`。

`gbVisNode::EnableShadow`（`0x1001d940`）仅保存节点 `+0x3c` 的开关。`gbActor::EnableShadow`（`0x1000a220`）和 `gbGeomNode::EnableShadow`（`0x10010b90`）再通过网格虚函数请求计算阴影体。actor 的正常提交路径在 `0x1000a0df` 检查 `+0x3c`，非零时于 `0x1000a0f3` 调用上述空的 `NewShadowVolume`。保留接口和开关不会令这份二进制产生阴影体。

`gbActor::RenderShadowVolume`（`0x1000a070`）与 `gbGeomNode::RenderShadowVolume`（`0x10010970`）保留了矩阵与网格虚调用包装，但没有闭合为有效的生成、入队和绘制链。未找到另一个生效的 shadow-map 深度渲染／采样路径。

## 地图与设置

原 `CDTank/Config/SystemSetting.ini` 的 Display 段包含 `Silhouette`、`HighPrecision`、`DistanceCull` 等选项，没有 Shadow 项。已读取的25份主地图同名 INI 没有阴影开关或阴影光源配置；它们的 scene／fog 配置不能自动当作动态阴影配置。

原静态场景可以在贴图和 packed 顶点色中保存明暗。0002地形确有部分非白顶点色；南瓜 `obj05431`、木箱 `obj05424` 与栅栏 `obj05434` 的所查原顶点色为白。这些数据说明静态颜色路径，不证明场景物件向地面动态投影，也不证明坦克与静态物件共用一套接地影。

原文件没有找到模型／场景对 `shadow` 路径的显式引用。坦克、树木、房屋、栅栏和破损模型是否在其他发行版本启用了独立投影，不由本次资源目录和此版二进制确定。

## 当前 Web

`apps/web/src/render/materials/mv3-material.ts`为战斗坦克保留原本体纹理与材质颜色，再应用共享场景光照和阴影。卡通描边沿既有TankView配置；独立原toon分支供没有场景光照owner的渲染使用。

当前战斗通过`SceneShadowLight`使用方向光与二维模型深度贴图生成软阴影，按白天、夜景、夕阳与室内配置角度、色彩和强度。坦克与三维场景物件共同投射、接收阴影并使用同一光照方向。始终面向相机的二维物件不参与。详见[ground-contact-shadows.md](ground-contact-shadows.md)。`apps/web/src/interface/home/home-player-model-scene.ts:22`的径向`contactShadows`供首页角色展示使用。

战斗接地影改善坦克与地面的接触感，属于视觉增强。当前统一场景光照与原客户端独立toon输入不同；现有证据不足以把该效果称为已证还原的原版投地阴影。

## 限制

范围限于随项目提供的这一份 EXE、DLL、原25张地图和原资源。工作为原文件读取、导出／字符串引用及静态反汇编，没有执行原客户端、测试、浏览器验收、构建或类型检查。`shadow.gbf` 的跨类无符号间接指针消费者尚未取得；线性寄存器查找不能排除任意跨函数别名，但没有找到坦克或静态物件接地影的正向生产调用链。不能据此推断其他版本或设备下的最终画面。
