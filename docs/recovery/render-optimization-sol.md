# M7-02 静态 terrain 矩阵冻结验证

0007 静态 terrain 的世界矩阵冻结保持像素、几何、原材质和纹理采样，但没有可归因的实际帧间隔改善。生产 `ScenePreview` 保持原路径。四阶段中心镜头均为47 draw calls、8,500 active triangles；候选没有减少渲染提交或几何工作。

## 候选与结果

只对原 `ScenePreview.load('0007')` 的 terrain AssetContainer 中57个mesh（包含无几何root）调用 `freezeWorldMatrix`，不冻结 placement、可破坏物件、相机或材质。terrain没有运行时位移路径，冻结仅省略静态变换更新。测试通过原Babylon `unfreezeWorldMatrix` 恢复基准，按A/B/A/B顺序分别五帧预热、30帧测量。

独立Vite5198、Chrome9248及profile，实际drawing buffer1920×1080、DPR1、hardware scaling1、抗锯齿开启，原0007素材与原sampler。相机alpha=-π/2、beta=π/6、radius700、地图中心目标；天空灯与场景成本诊断一致。

| 阶段 | 帧间隔 p50 / p95 (ms) | 同步render p50 / p95 (ms) | active mesh evaluation p50 (ms) | WebGL执行计时均值ms（样本） |
| --- | ---: | ---: | ---: | ---: |
| baseline-0 | 145.5 / 162.4 | 1.6 / 4.2 | 0.3 | 141.68 (8) |
| frozen-1 | 143.8 / 282.5 | 1.1 / 2.1 | 0.2 | 142.20 (9) |
| baseline-2 | 141.4 / 289.7 | 1.1 / 1.8 | 0.2 | 143.91 (10) |
| frozen-3 | 143.9 / 173.3 | 1.0 / 2.2 | 0.2 | 141.05 (10) |

第二次基准的同步render和active mesh evaluation已接近冻结阶段；冻结后的帧间隔也没有稳定低于前一个基准。计时不足以支持生产改动。

四阶段逐像素比较8,294,400个RGBA字节，变化数和最大差值均为零。terrain位置、法线、UV、索引、世界矩阵、材质身份和纹理身份/采样模式/wrap参数逐项一致。目标x平移1000的边缘镜头在冻结前后均为26 draw calls、5,147 active triangles，动态相机裁剪保持。

冻结后clear与原加载路径重载后clear均为mesh/geometry/material=0、texture=1。保留项为Babylon场景共享 `data:EnvironmentBRDFTexture0`，不是候选新增资源；加载前四类资源均为0，scene/engine dispose后四类资源全部回到0。

## 限制

本次是0007地图固定镜头有限对照，没有AI、战车、网络、技能或完整对局。测试期间同一宿主另有双网页SwiftShader对局及生产构建，时间受宿主竞争影响，不能外推普通硬件GPU性能或宣称完整高清战斗已优化。该浏览器此次提供8至10个有效WebGL timer样本/阶段；约141至144ms的执行时间来自软件WebGL实现，样本少于30个帧且覆盖包含预热，不是普通显卡GPU结论。原先浏览器timer不可用的诊断仍按其原测量保留。

## 复核

脚本 `tests/browser-render-optimization-sol.mjs`；逐帧、warmup、设备、相机、像素比较、库存、边缘裁剪和资源计数见 `recovery/output/browser-render-optimization-sol.json`，日志见 `recovery/output/render-optimization-sol.log`。

```sh
npm run dev -- --port 5198 --strictPort
# 独立profile启动Chromium，debug port9248。
node tests/browser-render-optimization-sol.mjs '<Chrome browser WebSocket URL>' http://127.0.0.1:5198
```

脚本关闭自身target；独立Chrome/Vite由启动者关闭。本次9248/5198已清理。
