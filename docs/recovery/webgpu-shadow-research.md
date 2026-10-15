# WebGPU 阴影样例与低开销方案

调研日期：2026-10-13。目标是保留坦克与场景共用的地图光源、明亮的卡通贴图和真实几何投影，在坦克平移、转向及动画时减少暗块、边缘锯齿和抖动。坦克接收面保持硬阴影，地面及其他场景接收面允许柔化；billboard 和二维特效不参与投影。

## 结论

性能优先：以单张 1024×1024、按镜头前方地面视野拟合的局部阴影图为起点，核心覆盖距离512–1400世界单位并限制投射物范围；坦克一次最近点深度比较，场景接收面用少量比较柔化。自定义接收面在距离末段渐隐投影，远景减少动态投影细节。光空间 texel 对齐减少移动时的投影跳动。扩大覆盖会增加投射绘制量，并降低固定分辨率下的空间精度。

四次硬件比较采样的 3×3 PCF 是后续优化参考。当前自定义材质以四次直接深度比较柔化，不等同于该加权硬件 PCF；PBR 接收面沿 Babylon 的比较采样路径。核不同、采样调用减少比例也不能直接当作帧率提升比例。

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

Babylon 的原生 WGSL 声明 `texture_depth_2d_array` 与 `sampler_comparison`，使用 `textureSampleCompare`。中等质量的 3×3 核只有四次比较采样；5×5 核为九次，另有单次比较版本。单次比较配上线性比较采样器仍可能产生滤波，不能直接当作坦克要求的最近点硬阴影。

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

Three.js 的 VSM 样例中，聚光灯为 256×256，方向灯为 512×512，半径为 4。WebGPU ShadowNode 在生成阴影后执行竖向与横向两次模糊绘制，所以低贴图分辨率并不等于总开销必然更低。其软化结果也不直接满足坦克接收面保持硬阴影的要求。

Babylon 的 PCSS 要做遮挡物搜索再滤波，低档为 16 次搜索与 16 次比较滤波，中档 16+32，高档 32+64；不宜作为本场景降低阴影采样成本的首选。

- [Three.js：VSM 分辨率与软化参数](https://github.com/mrdoob/three.js/blob/d9e7d62d1f7fd19a972c5979540bc24f846594d0/examples/webgpu_shadowmap_vsm.html#L114-L140)
- [Three.js：WebGPU VSM 的两次模糊绘制](https://github.com/mrdoob/three.js/blob/d9e7d62d1f7fd19a972c5979540bc24f846594d0/src/nodes/lighting/ShadowNode.js#L697-L730)
- [Babylon WGSL：PCSS 采样数量](https://github.com/BabylonJS/Babylon.js/blob/a6b8e226d46464328197447f9fc93054c7b494fb/packages/dev/core/src/ShadersWGSL/ShadersInclude/shadowsFragmentFunctions.fx#L710-L724)

## 验证范围

以上结论来自 GitHub 原始源码与公开样例页面，未测量这些外部样例在目标显卡上的帧时间。本项目已在复用游戏代码的 WebGPU viewer 中检查小幅平移、远离原点、不同朝向、动画和四类光照配置，并验证外部遮挡与投射物裁剪。软件设备 SwiftShader 用于确认渲染行为，目标显卡的帧率和阴影 GPU 开销仍需实测；详细范围见[场景光照与阴影](ground-contact-shadows.md)。
