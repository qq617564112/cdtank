# MV3 原运行法线采样

原 `gbengine.dll` 的 MV3 CPU 渲染路径先解码每帧 packedNormal，再线性插值 XYZ，不在提交顶点前归一化。三个真实模型的9个端点/中间时间样本与已发布 GLB 的 NORMAL morph 加权对照通过，最大分量绝对误差 `1.1920928955078125e-7`。

## 原渲染入口与采样

原调用者 `0x1000e873` 调用 `0x1000e160`。该函数准备材质，按原时间轨道选择相邻顶点帧，将每三角形展开为32字节顶点：XYZ、normal XYZ、UV。随后取得FVF `0x13` 的缓冲区，复制展开的顶点并提交。

| 指令位置 | 行为 |
| --- | --- |
| `0x1000e1da`–`0x1000e20f` | 时间取余末帧时间，查找相邻源帧 |
| `0x1000e299`–`0x1000e2e4` | `alpha=(time-firstTime)/(secondTime-firstTime)`，保留float32 alpha与 `1-alpha` |
| `0x1000e445`–`0x1000e4b9` | 第一角点读取两帧packedNormal，查 `0x10053390` 解码表，XYZ线性加权写入顶点偏移12/16/20 |
| `0x1000e565`–`0x1000e5d9` | 第二角点同样处理 |
| `0x1000e685`–`0x1000e6f5` | 第三角点同样处理 |
| `0x1000e741`–`0x1000e793` | 取得FVF `0x13` 缓冲，`0x1003c106`复制源顶点，调用缓冲对象提交接口 |

`tests/mv3-normal-sampling-sol-native.py` 执行真实入口 `0x1000e160` 至 `0x1000e741`，完整保留每个选中mesh的原帧数、原毫秒时间、所有顶点帧、三角形索引与UV。解码表各源值由原 `0x1000bed0` 与原 `msvcr71.dll` 实际执行产生。使用x87控制字 `0x37f`；只有 `0x10037140` profiling 和 `0x1001b6f0` 材质状态调用被截断，时间选择、顶点/法线插值与角点展开指令全部实际执行。

结果包含每个展开角点的原输出法线、长度和两帧packed值。中间输出显著短于单位长度，直接证明该CPU路径没有归一化：

| 源模型 | 两帧时间（毫秒） | 中间时间 | 中间最短法线长度 | 每次采样角点数 |
| --- | --- | --- | --- | --- |
| `role/001/01M.MV3` | 0、168 | 84 | 0.9999126127 | 858 |
| `role/001/04X.MV3` | 0、170 | 85 | 0.9565929925 | 180 |
| `Pet/001/n1.MV3` | 0、533 | 266 | 0.9641998069 | 1518 |

三个模型的两端点长度均约1。测试阈值为原CPU输出与源原解码值线性加权的每分量误差 `<2e-7`。

## glTF 与 Babylon 对照

`tests/mv3-normal-sampling-sol-glb.py` 读取已发布 GLB 的实际NORMAL基值与morph delta，按相同时间对相邻帧加权，逐角点与原渲染输出比较。还保留以下已安装 Babylon 源码片段：

- `glTFLoader.pure.js` 为每个NORMAL target构造 `Float32Array(base + delta)`。
- `morphTargetsVertex.js` 的纹理与attribute两路径均执行 `normalUpdated += (targetNormal - normal) * influence`。
- `pbr.vertex.js` 随后执行 `vNormalW = normalize(normalWorld * normalUpdated)`；非均匀缩放时先使用逆转置法线矩阵。

数据对照保留目标加载、权重和逐步运算的float32舍入，阈值 `<4e-7`，实际最大误差约 `1.2e-7`。这里验证的是Babylon源码定义的morph数据加权语义；该脚本没有运行GPU shader。

原CPU法线数据与Babylon的归一化前数据一致。Babylon PBR中的后续归一化会改变中间帧法线长度；例如攻击模型中间帧的最大分量变化约0.04128。此数值不表示光照误差，因为原D3D后续是否归一化尚未验证。

命令与证据：

```bash
recovery/.venv/bin/python tests/mv3-normal-sampling-sol-native.py
recovery/.venv/bin/python tests/mv3-normal-sampling-sol-glb.py
```

输出为 `recovery/output/mv3-normal-sampling-sol-native.json` 和 `mv3-normal-sampling-sol-glb.json`。前者保存完整渲染函数反汇编与9个原输出样本；后者保存逐样本误差和Babylon loader/shader源码片段。生产解码/转换器在本切片没有改动。

## 未完成范围

测试止于原CPU缓冲提交边界，没有模拟D3D设备、固定功能光照或原shader；原 `D3DRS_NORMALIZENORMALS` 设置、最终世界法线与光照结果仍需取证。当前证据不能证明Babylon PBR归一化与原最终画面一致。仅覆盖所列三个源mesh的首对相邻帧，不覆盖整套动作循环、混合、最后一帧回绕或全部动作播放速率。
