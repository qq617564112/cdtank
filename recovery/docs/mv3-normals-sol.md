# MV3 packedNormal 与动画法线

M3-03 的 MV3 法线已经由原 `gbengine.dll` 标量解码器恢复，并接入 MV3 转换入口。745 个现存 MV3、27695 帧、1538919 个源顶点中共出现 58951 种 packedNormal；逐值执行原函数与 Python 解码对照，最大分量绝对误差为 `1.1920928955078125e-7`。

## 原格式与执行依据

MV3 每个顶点为 `3 × i16 XYZ + u16 packedNormal`。原解码函数 `0x1000bed0` 对高字节使用 `movsx ecx, ah`，低字节通过 `and eax, 0xff` 读取。高字节为有符号方位角，低字节为极角；极轴为 Z。

| 原浮点常量地址 | 值 | 用途 |
| --- | --- | --- |
| `0x1003f85c` | `0.012319971807301044` | 极角步长 |
| `0x1003f860` | `0.003921568859368563` | 方位角比例 |
| `0x1003f864` | `3.1415927410125732` | 方位角 π |

令 `a = signed(highByte)`、`p = lowByte`：

```text
azimuth = float32(a * 2 * 0.003921568859368563 * 3.1415927410125732)
polar = float32(p * 0.012319971807301044)
s = float32(sin(polar))
normal = float32(cos(azimuth) * s), float32(sin(azimuth) * s), float32(cos(polar))
```

原函数的角度和正弦临时值写入单精度内存。实现保留这些舍入点。原 `msvcr71.dll` 与 Python 数学库的三角函数末位有差异；测试阈值为分量绝对误差 `3e-7`，实际最大误差约 `1.2e-7`。此对照使用 x87 控制字 `0x37f`，原解码器及其 `msvcr71.dll` 三角函数均实际执行，没有替换数学调用。

原 `0x1000bf70` 分配解码表并逐项调用 `0x1000bed0`。原 `0x1000b580` 还有从几何重建、累积、归一化并调用 `0x1000b330` 编码法线的路径；本实现读取文件已有 packedNormal。

`tests/mv3-normals-sol-native.py` 的输出 `recovery/output/mv3-normals-sol-native.json` 包含解码器逐指令反汇编、每个已出现 packed 值的原执行 XYZ、Python XYZ，以及真实文件/mesh/帧/顶点出处。没有使用基础帧三角形平面法线作为原法线证据。

## 转换与验证

`recovery/mv3_normals.py` 提供 `decode_packed_normal` 与 `decode_frame_normals`。`recovery/convert_mv3.py` 在 MV3 读取后设置每个 mesh 的 `normals` 和 `frameNormals`；首帧作为 glTF `NORMAL`，后续帧输出相对首帧的 `NORMAL` morph delta。每个 part 仍按源顶点索引展开角点，UV 索引独立。POL/CVD 的共享 GLB 写入接口及其源法线处理不变。

验证命令：

```bash
recovery/.venv/bin/python tests/mv3-normals-sol-native.py
recovery/.venv/bin/python tests/mv3-normals-sol-glb.py
recovery/.venv/bin/python recovery/convert_mv3.py --models-only
recovery/.venv/bin/python tests/mv3-normals-sol-glb.py --published
recovery/.venv/bin/python tests/assets-geometry.py
node tests/assets-validation.mjs
```

GLB 测试经实际转换 CLI，覆盖 `role/001/01M.MV3`、`04X.MV3`、`c14m.MV3` 与 `Pet/001/n1.MV3`：13 个 primitive，58470 个动画法线顶点。首帧法线精确保存 Python 单精度值；首帧加 morph delta 的每分量重建误差不超过 `1e-7`。独立测试 GLB 保留在 `recovery/output/mv3-normals-sol-glb/`，报告为 `mv3-normals-sol-glb.json`；已发布同模型报告为 `mv3-normals-sol-published.json`。

已用 `--models-only` 重建 `recovery/output/web-assets/` 下全部 745 个 MV3 GLB 与 `mv3-conversion.json`。源位置、UV、材质引用和时间不变，已有四模型几何对照通过。全部964个MV3/POL/CVD GLB标准校验0错误，结果为 `recovery/output/web-assets/validation.json`。此命令复用现有 PNG。

## 未完成范围

本对照验证文件法线解码及 GLB 首帧/动画法线数据，不代表原版光照或画面一致。原运行中的帧采样、插值、归一化及动作组合语义仍需单独校准；实际网页已验证数据上传和着色路径；原版视觉一致性尚未验收。纹理缺口、皮肤覆盖和原材质光照不在本切片验收范围，M3-03 整体仍未完成。

## 实际网页数据与高清画布

`npm run test:tanks:normals:browser -- <CDP>`在正式TankView加载路径检查21战车、待机/移动/开火/死亡/复活共105动作样本。每个基础NORMAL及Babylon绝对morph normal与GLB基础值加源delta逐分量核对；最大误差2.9802322387695312e-8。当前实际WebGL渲染完成2058次原ambient-only position morph shader检查，非空缺纹理仍保留12次原型PBR normal shader路径。源基础/绝对morph normal数据仍逐值核对，原普通shader不读取normal；具体生产范围见mv3-material-runtime.md。数据来源仍由上述原解码对照支撑。

正常查看器在1920×1080和3840×2160 viewport、DPR1、hardwareScaling1下实际canvas/render均与viewport相同，基础法线模型可见并保存截图。证据`browser-mv3-normals.json`、`mv3-normals-browser.log`、`mv3-normals-1920.png`/`mv3-normals-3840.png`。此为真实资产渲染验收，测试直接驱动TankView动作，不是服务器对局；高清完整多人性能、所有页面DPR2和原D3D光照/插值仍未由此证明。
