# M7-02 0007 场景渲染成本诊断

0007 单独渲染的实际帧间隔中位数为 145.2 ms，同步 JavaScript `scene.render()` 仅 1.2 ms；加五辆普通战车后分别为 167.4 ms 与 3.7 ms。本机使用 SwiftShader 软件 WebGL2。当前主要等待位于 JavaScript 场景提交以外的渲染执行、呈现或调度环节，不能直接认定 GPU 像素填充率瓶颈，也不能据此认定普通显卡慢。

## 方法与结果

独立 Vite 5178、Chrome 9240、独立 profile、单页面。原 `ScenePreview.load('0007')` 与原 `TankView.load`（包含死亡动作预载），保留 GLB 原材质、抗锯齿与天空灯。实际 drawing buffer 1920×1080，DPR=1，hardware scaling=1。相机 alpha=-π/2、beta=π/6、radius=700、目标为地图中心，radius 与 Battle 入场一致。战车 ID 为 1、2、3、4、51，默认 idle 动作，在目标附近间隔 45 放置。

每阶段单独记录前五个 warmup 帧，再统计 30 个有效帧。前五帧并不保证覆盖所有 shader 编译。帧间隔取连续 render loop 开始时间，CPU 取同步调用。Babylon 计时彼此重叠，不能相加。

| 指标 | 0007 地图 | 0007 + 五辆战车 |
| --- | ---: | ---: |
| 有效帧 | 30 | 30 |
| 实际帧间隔 p50 / p95 (ms) | 145.2 / 171.9 | 167.4 / 177.2 |
| CPU scene.render p50 / p95 (ms) | 1.2 / 3.2 | 3.7 / 6.1 |
| CPU Babylon render p50 / p95 (ms) | 0.8 / 2.5 | 2.6 / 4.7 |
| CPU active-mesh evaluation p50 / p95 (ms) | 0.3 / 0.6 | 0.4 / 0.6 |
| CPU Babylon animations p50 / p95 (ms) | 0 / 0 | 0 / 0.1 |
| Active meshes | 48 | 92 |
| Active triangles | 8,500 | 11,196 |
| Draw calls | 47 | 71 |
| Scene 总 mesh 数 | 103 | 248 |
| Enabled geometry mesh 数 | 79 | 103 |
| GPU timer query | 不可用 | 不可用 |

Active meshes 包含无几何 root，不等于 draw calls。三角形取 Babylon `getActiveIndices()/3`；GLB 使用无索引几何，单 mesh `getTotalIndices()` 为零不代表三角形为零。

五辆战车增加 24 draw calls、2,696 active triangles。`TankView.advanceAnimations` 采样 175 次（含五个预热帧），单辆单次平均 0.134 ms、p95 0.3 ms。这条原战车动画路径已实际执行；Babylon animations 指标不包含完整的自定义 onBeforeRender 动画逻辑。增加战车后的 CPU 总成本仍远小于实际帧间隔。

预热首帧同步渲染分别为 17.5 / 14.0 ms，第二帧间隔 476.0 / 309.3 ms。有效帧表排除前五帧。GPU timer query capability=false，GPU samples=0，GPU 时间记为 null。

## 优化候选当前状态

0007静态terrain同材质合并已验证，实际56个primitive各自独占材质对象且全部MASK，按身份分组batch为0；draw calls保持47。同镜头中心/边缘像素完全一致、31629顶点位置/法线/UV误差0、clear及取消载入无残留。生产候选已撤回，详见terrain-merge-sol.md；不能因材质名称相同就称存在有效合并收益。

静态terrain固定世界矩阵候选已完成A/B/A/B：帧间隔p50=145.5/143.8/141.4/143.9ms，无稳定收益；生产未修改。像素、几何、材质、sampler及边缘裁剪一致；clear和原reload都保留scene BRDF共享纹理，scene.dispose后资源归零。详见render-optimization-sol.md。本次软件GPU计时有样本但含warmup，且与构建/对局并行，不当硬件性能结论。完整性能验收仍需真实硬件GPU及可用计时。

## 范围与限制

这是固定镜头两阶段渲染诊断，不是完整对局验收；没有 AI、网络、战斗特效、移动、死亡或重启。SwiftShader 可能与其他浏览器进程竞争宿主 CPU，单页结果不能按比例外推双端实时对局的 439 ms。同步 CPU 测量不含异步 GPU 工作；未取得 GPU 时间，不能进一步区分软件 raster、驱动等待、呈现调度与宿主竞争。

## 复核

脚本 `tests/browser-scene-cost-sol.mjs`；逐帧数据、warmup、设备、相机、活跃网格与库存见 `recovery/output/browser-scene-cost-sol.json`。

```sh
npm run dev -- --port 5178 --strictPort
# 独立 profile 启动 Chromium，debug port 9240。
node tests/browser-scene-cost-sol.mjs '<Chrome browser WebSocket URL>' http://127.0.0.1:5178
```

脚本关闭自身 target；独立 Chrome/Vite 由启动者关闭。本次 9240/5178 已清理。
