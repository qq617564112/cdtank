# WebGPU 动态模糊

系统设置在抗锯齿下方提供“动态模糊”，默认关闭。切换开关立即预览，点击确定保存，取消恢复原状态，恢复默认会预览关闭效果。`cdtank.display-settings.v1` 保存 `motionBlur` 布尔值，已有保存缺少该字段时按关闭读取。

## 官方来源

- [Babylon.js 动态模糊文档](https://doc.babylonjs.com/features/featuresDeepDive/postProcesses/motionBlurPostProcess/)及其[屏幕模式示例](https://playground.babylonjs.com/#E5YGEL#7)区分物体速度和相机运动两种模式。官方建议大型场景可选屏幕模式，减少逐物体速度计算。
- 项目使用 Babylon.js 9.29.0。对应源码提交为 `cbe5bb36998fdde6bd93d76e67813ff571a535db`。[ThinMotionBlurPostProcess](https://github.com/BabylonJS/Babylon.js/blob/cbe5bb36998fdde6bd93d76e67813ff571a535db/packages/dev/core/src/PostProcesses/thinMotionBlurPostProcess.ts#L29)在 WebGPU 下直接加载 WGSL；[绑定代码](https://github.com/BabylonJS/Babylon.js/blob/cbe5bb36998fdde6bd93d76e67813ff571a535db/packages/dev/core/src/PostProcesses/thinMotionBlurPostProcess.ts#L119)维护前后帧视图投影矩阵。
- [官方 WGSL](https://github.com/BabylonJS/Babylon.js/blob/cbe5bb36998fdde6bd93d76e67813ff571a535db/packages/dev/core/src/ShadersWGSL/motionBlur.fragment.fx#L59)使用相机空间 Z 重建位置，根据前后帧投影差沿运动方向采样；样本数随像素速度增加，并受 `SAMPLES` 上限约束。背景深度为0时直接输出当前像素。
- [官方 GeometryBufferRenderer](https://github.com/BabylonJS/Babylon.js/blob/cbe5bb36998fdde6bd93d76e67813ff571a535db/packages/dev/core/src/Rendering/geometryBufferRenderer.pure.ts#L215)支持 `objectIdProvider`、`enableObjectId` 和 `enableVelocityLinear`，可在同一次几何绘制中输出对象标记和速度；[几何 WGSL](https://github.com/BabylonJS/Babylon.js/blob/cbe5bb36998fdde6bd93d76e67813ff571a535db/packages/dev/core/src/ShadersWGSL/geometry.fragment.fx#L17)使用前后帧世界矩阵及视图投影矩阵计算运动。线性速度为上一帧UV减当前UV，对象标记0表示背景或排除对象。
- [Three.js 官方 WebGPU 动态模糊示例](https://threejs.org/examples/webgpu_postprocessing_motion_blur.html)将颜色和速度写入 MRT，再沿速度方向采样。固定版本[示例源码](https://github.com/mrdoob/three.js/blob/71cb5185ecfcead4755bde487d076d5bedf56c57/examples/webgpu_postprocessing_motion_blur.html#L182)及[采样实现](https://github.com/mrdoob/three.js/blob/71cb5185ecfcead4755bde487d076d5bedf56c57/examples/jsm/tsl/display/MotionBlur.js#L3)表明，动态模糊需要方向性运动信息，采样数量直接影响质量和开销；该实现默认16个样本。

## 项目接入

`BattleMotionBlur` 使用 Babylon 官方 `GeometryBufferRenderer` 的原生WGSL几何绘制，输出最近邻采样的RG16F线性运动矢量及R8UI二值标记。`enableMeshBlendingTag` 开启单通道整数附件，`meshBlendTagProvider` 提供0／1；不启用额外的网格混合后处理。颜色深度和法线附件关闭，只保留硬件深度测试与两个颜色附件；几何缓冲不启用MSAA。几何着色器独立于世界自定义材质，不要求世界材质增加MRT输出。后处理使用项目WGSL，依据曝光期间的像素位移选择1至4次颜色采样，沿速度方向均匀取样；静止像素只取当前颜色。

`BattlePlayers` 在主相机绘制前提供本地玩家的 `TankView.root`。该节点下的坦克、炮塔、预加载动作和模型饰品写标记0，其他世界网格写1；标记沿用几何深度测试结果，遮挡玩家的前景仍能参与模糊。玩家像素直接保留当前颜色，其他像素沿模糊方向取样时跳过标记0的区域，避免采入玩家颜色。作用范围包括相机移动造成的环境屏幕位移及其他网格自身的平移、旋转、缩放；玩家炮塔转速不增加其模糊采样。

渲染顺序为战场几何缓冲与颜色、动态模糊（直接接收世界颜色）、FXAA（开启抗锯齿时）、名牌与小地图 utility layers、屏幕 HUD。颜色目标按战场分辨率倍率及动态分辨率档位分配；几何缓冲的宽、高为所选倍率的一半，不随档位变化，玩家标记边缘按该分辨率取整。移动端以已经缩放的战斗画布尺寸为基准。世界颜色目标为单采样。效果不持有前帧颜色，不做整屏历史叠加；前帧信息为每个网格的世界矩阵、视图投影矩阵及官方骨骼速度数据。

60 FPS时模糊强度为0.5，直接以 `0.5 / scene.getAnimationRatio()` 缩放线性速度，对应约1/120秒的固定曝光时间。首次应用、改变尺寸、相邻有效帧间隔超过100毫秒，或相机单帧位移超过相机到目标距离、方向改变超过45度时，当前帧强度设为0，几何缓冲仍推进运动历史。新出现或重新进入视野的网格从当前姿态建立世界矩阵与投影历史，预加载动作切换不沿用旧动作停用前的位移。

移除网格时释放其运动历史，退出战斗时清除玩家排除根节点。关闭、重建或释放运行时时，销毁后处理、网格移除订阅和几何缓冲；玩家根节点记录保留到下一次战斗更新，使设置预览重建效果后仍能排除玩家。关闭后由 FXAA 或直通分辨率 pass 接收世界颜色，不绘制额外几何 pass。

## 单通道标记存储

后处理只需区分0和1。原RGBA8对象标记仅使用alpha，当前R8UI直接读取red整数值。归一化UV按 `floor(uv * textureDimensions)` 转为像素，再夹紧至 `[0, size - 1]`，最后 `textureLoad(..., 0).r` 读取；保留原最近邻和clamp-to-edge规则，UV为1时读取最后一列／行。中心像素和全部偏移样本使用同一规则，颜色与速度采样保持原值。

已从安装版本源码确认：GeometryBufferRenderer为该标记固定创建unsigned-byte／RED_INTEGER单采样附件，清除色为全零；几何WGSL直接输出整数标记。WebGPU纹理映射为 `r8uint`，WGSL处理器把 `texture_2d<u32>` 绑定为uint纹理，且未声明采样器的整数读取无需过滤采样器。标记和原对象ID的provider均接收实例的源网格，玩家后代判定保持原值。速度历史、硬件深度、相机切换和释放路径保持原值。

| 标记附件实际尺寸 | 原RGBA8像素数据 | 当前R8UI像素数据 | 减少 |
| --- | ---: | ---: | ---: |
| 1920 × 1080 | 8,294,400字节（7.91 MiB） | 2,073,600字节（1.98 MiB） | 6,220,800字节（5.93 MiB） |
| 3840 × 2160 | 33,177,600字节（31.64 MiB） | 8,294,400字节（7.91 MiB） | 24,883,200字节（23.73 MiB） |

每像素从4字节减至1字节，这张附件的像素数据减少75%；不代表整个动态模糊或整帧带宽减少75%。表格按实际附件尺寸计算，不含驱动对齐、压缩及临时资源，手机使用已缩放画布尺寸，电脑使用战场倍率后的尺寸。两端及两套画质共用，动态模糊默认关闭，关闭时本项收益为零。此项只修改运行代码，无源图或public资源变化；没有新的手机、GPU或画面实测。

## 限制与验证范围

4次颜色采样适合短距离模糊，高速屏幕位移仍可能呈现分段拖影。后处理还会读取运动矢量和对象标记；开启后增加一次几何绘制及两个颜色附件的存储与带宽开销，不能用4/16直接估计整帧成本。

官方几何着色器支持模型变换及骨骼，当前形变目标只能提供当前形状，不能完整重建上一帧顶点形变。自定义植物摆动、CPU更新顶点的粒子与精灵、禁用深度写入的特效没有独立的完整运动矢量；这些区域可能沿覆盖位置的几何速度参与采样。透明材质的自定义透明度及裁剪公式、卡通描边扩张也不完全等同几何缓冲轮廓，边缘可能有误差。独立于坦克根节点的替身与技能特效不属于玩家模型排除范围。

本次依据官方文档、固定版本源码和静态接线走查；按仓库要求未执行测试、浏览器验收、构建或类型检查，未量化当前地图及设备上的性能和视觉效果。
