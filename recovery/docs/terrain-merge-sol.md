# M7-02 0007 静态 terrain 合并条件

0007 当前资源不满足“同一实际材质对象合并”的条件：terrain GLB 有 56 个 primitive 与 56 个 material 条目，每个 primitive 独占一个 material。`shu.TGA`、`hua.tga` 等重名纹理没有共享材质身份。所有 terrain material 的 alphaMode 为 MASK。符合本次材质身份与透明顺序约束的 batch 数为零，draw calls 保持 47；没有生产代码改动。

## 有限对照

独立 Vite5178、Chrome9240，1920×1080、DPR1、hardwareScaling1、原几何/材质/抗锯齿，原 `ScenePreview.load('0007')`。中心镜头 alpha=-π/2、beta=π/6、radius700；裁剪对照把目标 x 平移1000。每阶段五帧预热、20帧测量。

| 指标 | 基准 | 合并条件评估 |
| --- | ---: | ---: |
| 合并 batch | 0 | 0 |
| 中心 draw calls | 47 | 47 |
| 中心 active triangles | 8,500 | 8,500 |
| 边缘 draw calls | 26 | 26 |
| 边缘 active triangles | 5,147 | 5,147 |
| 中心帧间隔 p50 / p95(ms) | 215.7 / 239.1 | 153.3 / 186.2 |
| CPU render p50 / p95(ms) | 1.7 / 9.1 | 1.2 / 1.6 |
| CPU culling p50 / p95(ms) | 0.4 / 1.3 | 0.3 / 0.8 |
| clear 后 mesh / geometry / material | 0 / 0 / 0 | 0 / 0 / 0 |

中心与边缘截图均为1920×1080，逐像素变化为零。31,629 个已启用非instance几何顶点的世界坐标、法线与UV对照最大误差为零；placement实例仍由原加载路径管理。清理后scene资源全部归零。加载目录请求等待时调用clear取消，加载结果为空字符串且mesh数为零。

无 batch、无 draw call 下降，两个阶段的时间差不能归因于优化。SwiftShader 软件渲染与宿主竞争影响时间；这组数据不代表普通显卡性能，也不是完整对局验收。

## 复核材料

- `tests/browser-terrain-merge-sol.mjs`：校验0007真实material条目是否复用，加载/重载、几何、中心与边缘draw/triangle、clear与加载取消。
- `recovery/output/browser-terrain-merge-sol.json`：逐帧、完整几何与像素比较结果。
- `recovery/output/terrain-merge-baseline.png` 与 `terrain-merge-merged.png`：中心截图。
- `recovery/output/terrain-merge-baseline-edge.png` 与 `terrain-merge-merged-edge.png`：裁剪镜头截图。

脚本使用独立CDP浏览器URL和可选Vite origin。测试结束关闭自身target，启动者关闭Chrome/Vite。本次5178/9240已清理。
