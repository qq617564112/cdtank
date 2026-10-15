# WebGPU 阴影样例与低开销方案

调研日期：2026-10-15。目标是保留坦克与场景共用的地图光源、明亮的卡通贴图和向场景投射的真实几何阴影，在坦克平移、转向及动画时减少暗块、边缘锯齿和抖动。坦克只投射阴影，本体保持地图方向光受光，地面及其他场景接收面使用双线性PCF柔化；billboard 和二维特效不参与投影。

## 结论

性能优先：使用单张 1024×1024、按镜头前方地面视野拟合的局部阴影图，核心覆盖距离512–1400世界单位并限制投射物范围；自定义材质与PBR共用硬件比较深度。坦克关闭实时几何阴影接收，不计算阴影坐标或斜面梯度、不查询阴影贴图，方向光明暗及向地面和场景投影保持开启；外物投到坦克上的几何阴影也被省略。场景接收面执行四次双线性PCF查询，不增加投射绘制或阴影贴图。生成端关闭颜色写入、仅清空深度，减少浮点颜色深度的输出开销。自定义接收面在距离末段渐隐投影，远景减少动态投影细节。光空间 texel 对齐减少移动时的投影跳动。扩大覆盖会增加投射绘制量，并降低固定分辨率下的空间精度。

当前场景接收面将四个固定偏移的双线性PCF结果平均，偏移半径沿用各地图`softness/2`个texel；每次查询都对比较结果过滤，保持移动时的连续过渡。Babylon按子texel位置调整权重的3×3 tent核提供另一种四次查询方案。两种核不同，采样调用次数也不能直接当作帧率或硬件内部比较次数。

多级 CSM、VSM 和 PCSS 作为画质方案保留，不作为默认性能方案。CSM 通过增加深度存储和投射绘制换取远近精度；VSM 增加模糊绘制；PCSS 增加遮挡物搜索。偏移和接收端计算仍需正确，减少采样不能替代正确的动画顶点、投影矩阵和深度比较。

生成阴影每帧一次，保持移动坦克和当前阴影一致。固定投影下的静态层可以缓存，需额外维护与动态层的遮挡关系；是否引入该复杂度，以本项目真实 GPU 开销为准。

## 可打开的样例

| 项目 | 在线样例 | 主要用途 |
| --- | --- | --- |
| toji/webgpu-shadow-playground | [WebGPU Shadow Playground](https://toji.github.io/webgpu-shadow-playground/) | 调整阴影分辨率、级联数量、深度与斜率偏移，查看级联覆盖；源码提供多档 PCF 与隔帧刷新 |
| mrdoob/three.js | [WebGPU 级联阴影](https://threejs.org/examples/webgpu_shadowmap_csm.html) | 观察近远景精度分配与不同分层方式；样例配置四层、2048 分辨率 |
| mrdoob/three.js | [WebGPU VSM](https://threejs.org/examples/webgpu_shadowmap_vsm.html) | 观察低分辨率下的软阴影；代价包含额外的两次模糊绘制 |
| webgpu/webgpu-samples | [Shadow Mapping](https://webgpu.github.io/webgpu-samples/?sample=shadowMapping) | 最小的原生 WebGPU 深度图、比较采样器和 PCF 流程 |

在线页面均已通过 HTTP 获取，源码以以下提交固定；页面当前部署版本可能变化。

## 源码核对

### 少量硬件比较采样

Babylon 的原生 WGSL 声明 `texture_depth_2d_array` 与 `sampler_comparison`，使用 `textureSampleCompare`。中等质量的 3×3 核只有四次比较采样；5×5 核为九次，另有单次比较版本。线性比较采样器过滤比较后的可见度，而不是先插值原始深度；单次查询也能平滑阴影边缘。

本项目使用Babylon 9.29.0的GLSL到WGSL路径：`sampler2DShadow`声明映射为深度纹理与比较采样器，`ShaderMaterial.setInternalTexture`绑定生成器的硬件深度附件，`textureLod(...,0)`执行显式LOD比较。接收面使用与硬件附件一致的裁剪深度，查询偏移按接收平面梯度校正，并为双线性覆盖增加一个texel的斜面容差。WebGPU API及WGSL约束见[WebGPU规范](https://www.w3.org/TR/webgpu/)与[WGSL纹理比较采样](https://www.w3.org/TR/WGSL/#texturesamplecomparelevel)。

- [Babylon WGSL：单次比较及四次采样的 3×3 PCF](https://github.com/BabylonJS/Babylon.js/blob/a6b8e226d46464328197447f9fc93054c7b494fb/packages/dev/core/src/ShadersWGSL/ShadersInclude/shadowsFragmentFunctions.fx#L257-L305)
- [Babylon WGSL：九次采样的 5×5 PCF](https://github.com/BabylonJS/Babylon.js/blob/a6b8e226d46464328197447f9fc93054c7b494fb/packages/dev/core/src/ShadersWGSL/ShadersInclude/shadowsFragmentFunctions.fx#L308-L346)
- [原生 WebGPU 样例：九次比较采样](https://github.com/webgpu/webgpu-samples/blob/e040ec1a20dbbe01afed30c812e825b2639cfe5b/sample/shadowMapping/fragment.wgsl#L24-L38)
- [toji：1、2、4、9、16 次采样配置](https://github.com/toji/webgpu-shadow-playground/blob/dc89f19bde24537282192d01f46f8f642ab2b34b/js/engine/webgpu/wgsl/shadow.js#L14-L48)
- [toji：比较采样循环](https://github.com/toji/webgpu-shadow-playground/blob/dc89f19bde24537282192d01f46f8f642ab2b34b/js/engine/webgpu/wgsl/shadow.js#L100-L117)

### 稳定近景精度

Three.js 的 WebGPU 样例直接使用 `WebGPURenderer` 和 `CSMShadowNode`，配置四个级联，展示 uniform、logarithmic、practical 分层。Babylon 的 `stabilizeCascades` 明确针对转动镜头时的游动、闪烁，并说明会牺牲部分精度。

- [Three.js：WebGPU 与四级 CSM 配置](https://github.com/mrdoob/three.js/blob/d9e7d62d1f7fd19a972c5979540bc24f846594d0/examples/webgpu_shadowmap_csm.html#L98-L137)
- [Three.js：阴影距离与分层控制](https://github.com/mrdoob/three.js/blob/d9e7d62d1f7fd19a972c5979540bc24f846594d0/examples/webgpu_shadowmap_csm.html#L200-L209)
- [Babylon：稳定级联说明](https://github.com/BabylonJS/Babylon.js/blob/a6b8e226d46464328197447f9fc93054c7b494fb/packages/dev/core/src/Lights/Shadows/cascadedShadowGenerator.pure.ts#L108-L112)
- [toji：分辨率、偏移与级联控制](https://github.com/toji/webgpu-shadow-playground/blob/dc89f19bde24537282192d01f46f8f642ab2b34b/index.html#L181-L215)

### 阴影更新频率与缓存

toji 用帧计数按 `shadowUpdateFrequency` 跳过整次阴影更新。Babylon 的 render target 使用 `refreshRate=0` 绘制一次、1 每帧、2 每两帧，并提供 `resetRefreshCounter()` 重新触发。

隔帧更新只减少生成阴影的频率，不修复空间分辨率或自遮挡。坦克移动和变形而深度图未更新时，显示几何与阴影几何不再对应，会产生滞后和错误自遮挡。跟随镜头的级联投影也会变化，因此场景物体静止不等于级联阴影可永久冻结。

可缓存固定投影下的静态场景阴影，发生破坏、物件变动或光源／投影变化时更新。与动态坦克分层缓存属于本项目的可选实现方向，需要维护两层的遮挡关系；样例的全局隔帧开关并不直接提供该功能。`freezeShadowCastersBoundingInfo` 仅冻结包围盒计算，也不等于冻结阴影图。

- [toji：实际跳帧逻辑](https://github.com/toji/webgpu-shadow-playground/blob/dc89f19bde24537282192d01f46f8f642ab2b34b/js/engine/webgpu/webgpu-shadow.js#L154-L170)
- [Babylon：刷新频率与重置](https://github.com/BabylonJS/Babylon.js/blob/a6b8e226d46464328197447f9fc93054c7b494fb/packages/dev/core/src/Materials/Textures/renderTargetTexture.pure.ts#L909-L925)
- [Babylon：冻结投射物包围盒的实现](https://github.com/BabylonJS/Babylon.js/blob/a6b8e226d46464328197447f9fc93054c7b494fb/packages/dev/core/src/Lights/Shadows/cascadedShadowGenerator.pure.ts#L117-L136)

### 软阴影的额外成本

Three.js 的 VSM 样例中，聚光灯为 256×256，方向灯为 512×512，半径为 4。WebGPU ShadowNode 在生成阴影后执行竖向与横向两次模糊绘制，所以低贴图分辨率并不等于总开销必然更低。

Babylon 的 PCSS 要做遮挡物搜索再滤波，低档为 16 次搜索与 16 次比较滤波，中档 16+32，高档 32+64；不宜作为本场景降低阴影采样成本的首选。

- [Three.js：VSM 分辨率与软化参数](https://github.com/mrdoob/three.js/blob/d9e7d62d1f7fd19a972c5979540bc24f846594d0/examples/webgpu_shadowmap_vsm.html#L114-L140)
- [Three.js：WebGPU VSM 的两次模糊绘制](https://github.com/mrdoob/three.js/blob/d9e7d62d1f7fd19a972c5979540bc24f846594d0/src/nodes/lighting/ShadowNode.js#L697-L730)
- [Babylon WGSL：PCSS 采样数量](https://github.com/BabylonJS/Babylon.js/blob/a6b8e226d46464328197447f9fc93054c7b494fb/packages/dev/core/src/ShadersWGSL/ShadersInclude/shadowsFragmentFunctions.fx#L710-L724)

## 验证范围

以上结论来自 GitHub原始源码、公开样例页面及本地Babylon 9.29.0源码，未测量这些外部样例在目标显卡上的帧时间。2026-10-15硬件比较采样改动未运行浏览器验收、测试、构建或类型检查，不能确认目标显卡的帧率变化；硬件内部比较增多与颜色写入减少需结合实测评估。2026-10-13的WebGPU viewer证据覆盖当时的小幅平移、远离原点、不同朝向、动画、四类光照配置、外部遮挡与投射物裁剪；SwiftShader软件设备的结果不代表本轮过滤效果或目标显卡性能，详细范围见[场景光照与阴影](ground-contact-shadows.md)。
