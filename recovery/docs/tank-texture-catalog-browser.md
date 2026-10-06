# tanktexture 全目录 WebGL 验收

711条原 `tanktexture.dat` 目录中的680张已解析A/B PNG全部通过实际GPU加载、尺寸、采样器与生产MV3材质framebuffer检查。2720个采样点的RGBA与预期完全一致，最大分量误差0；测试允许误差1。

| 范围 | 数量 |
| --- | ---: |
| 原目录记录 | 711 |
| A/B纹理请求 | 792 |
| 已解析PNG / GPU加载成功 | 680 / 680 |
| A / B | 599 / 81 |
| M / U / XY | 323 / 195 / 162 |
| 256×256 / 128×128 / 512×512 / 512×256 | 501 / 162 / 1 / 16 |
| framebuffer采样点 / 精确一致 | 2720 / 2720 |
| 每张释放后的scene / texture | 0 / 0 |
| 最终engine | 0 |

`tests/browser-tank-texture-catalog.mjs` 直接读取导出的 `tank-textures.json`，逐一遍历所有 `status=resolved` 的A/B条目，不按可选性或账号持有状态筛选。页面导航到目录JSON，再导入生产 `apps/web/src/mv3-material.ts` 与Babylon依赖；使用64×64画布、显式quad和正交相机。每张PNG使用真实Babylon `Texture` 加载，无mipmap，`invertY=true`。检查 `isReady()` 和GPU尺寸与PNG独立解码尺寸一致。

每张PNG在四个不同的内部位置取texel center，quad四个顶点使用相同UV，避免LINEAR混合相邻texel。PNG顶端坐标 `(x,y)` 对应UV `((x+0.5)/width, 1-(y+0.5)/height)`。预期RGBA来自独立 `Image.decode()`、Canvas2D `getImageData()`：RGB乘默认环境光0.2后舍入，alpha保留源值。实际RGBA来自生产 `createMv3Material` 渲染后的 `gl.readPixels`。白色不透明源properties使材质使用 `newgeom` 路径，禁用alpha blending；WebGL上下文 `premultipliedAlpha=false`。本次全部2720个源采样点alpha为255。

纹理先以NEAREST加载，生产材质入口将其改为LINEAR/WRAP。测试绑定实际hardware texture后读取 `gl.getTexParameter`，680张均为min/mag `LINEAR=9729`、S/T `REPEAT=10497`，随后恢复原绑定。每张纹理对应的scene在 `finally` 释放，确认engine的scene列表与纹理缓存均为空；最终释放engine及canvas。

## 复现与证据

在仓库根目录启动独立Vite与Chrome，保留现有3001/5173服务。两条服务命令分别在终端持续运行：

```bash
npm run dev -- --port 5198 --strictPort
```

```bash
/home/node/.cache/puppeteer/chrome/linux-150.0.7871.24/chrome-linux64/chrome \
  --headless --no-sandbox --disable-dev-shm-usage \
  --use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader \
  --remote-debugging-port=9252 --user-data-dir=/tmp/cdtank-catalog-chrome-9252 about:blank
```

```bash
node tests/browser-tank-texture-catalog.mjs
# 或指定独立Chrome的CDP endpoint及Vite URL：
node tests/browser-tank-texture-catalog.mjs '<CDP-WebSocket-URL>' 'http://127.0.0.1:5198'
```

本次环境为Chrome150、WebGL2、ANGLE Vulkan SwiftShader。结果保存到 `recovery/output/browser-tank-texture-catalog.json`，包含680条逐纹理证据：recordId、tankId、part、A/B、原request/source、资产URL、GPU尺寸、实际GL sampler、每点PNG像素坐标/UV/sourceRGBA/expected/actual以及释放后计数。终端结果见 `recovery/output/browser-tank-texture-catalog.log`。证据目录由仓库忽略规则排除。

脚本关闭自己创建的页面，完成后停止本次启动的Vite5198与Chrome9252。3001/5173端口的服务未由本次验收启动或停止。

## 验证边界

112个 `missing-source` 请求保持目录缺失状态，不进入PNG加载验收。本测试证明680张已解析导出PNG在当前WebGL生产材质上的加载与指定点采样结果；四个点不覆盖每张PNG的全部texel。原DDS到PNG转换、原D3D最终framebuffer、真实账号贴图授权、实际角色mesh完整UV、`geom_t`透明阈值与混合、完整场景性能分别由其对应的来源或运行测试验证，不由本目录采样结果推导。
