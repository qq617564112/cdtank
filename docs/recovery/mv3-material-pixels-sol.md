# MV3 原材质 Web framebuffer 验证

`createMv3Material` 的环境光颜色、纹理UV、透明阈值和position morph已通过实际WebGL framebuffer像素检查。四个颜色/透明度场景、一个采样状态场景与一个morph场景均通过，包含glTF反射后的正面可见与反面剔除。

测试使用独立Chrome、SwiftShader/WebGL2、128×128显式画布，调用生产 `apps/web/src/mv3-material.ts`。通过 `gl.readPixels` 读取刚渲染的帧缓冲，而非检查uniform或仅确认shader编译。正交相机前的显式quad使用源properties、源UV与RGBA纹理（初始NEAREST由生产入口改为LINEAR/WRAP）；背景黑色。RGB/alpha像素每分量容差2，本次所有列出的像素与预期一致。

| 场景 | 源输入 | 预期与实际RGBA |
| --- | --- | --- |
| 环境光，无纹理 | 原17字段，diffuseRGB `[0.5,0.75,1]`，默认ambientRGB0.2 | `[26,38,51,255]` |
| 2×2纹理UV | 红/绿/蓝/白四象限、原UV `[0,0]`–`[1,1]`，`invertY=false` | `[51,0,0,255]`、`[0,51,0,255]`、`[0,0,51,255]`、`[51,51,51,255]` |
| LINEAR/WRAP状态 | 实际GL min/mag=LINEAR、wrapS/T=REPEAT；UV平移U+1/V−1 | 双线性中心与跨边界中心均 `[26,26,26,255]` |
| geom_t阈值相等 | 白纹理alpha200/255，opacity0.5，即alpha100/255 | `[0,0,0,255]`，像素被discard |
| geom_t阈值以上 | 白纹理alpha202/255，opacity0.5，即alpha101/255 | `[20,20,20,255]`，存活并混合到黑背景 |
| position morph | 同源quad的target沿X平移1.5，权重0→1 | 旧区域 `[51,51,51,255]`→黑；新区 `[51,51,51,255]` |

预期来自 `newgeom.gbf`/`geom_t.gbf` 的 `Diffuse=ambient` 与TEXTURE×CURRENT合同，环境光参数计算见 `mv3-normal-d3d-state-sol.md`。透明输出的RGB为 `0.2 * 101/255 * 255 ≈ 20`；Babylon ALPHA_COMBINE对当前不透明黑背景保持输出alpha255。

## 剔除与反射

同环境光场景同时验证实际glTF加载器的左手场景约定：mesh `ClockWiseSideOrientation=0`，Z缩放−1。生产材质保留 `backFaceCulling=true`，反射后的源正面输出 `[26,38,51,255]`；交换三角形索引后输出黑背景，说明反面被剔除。未通过关闭剔除使测试通过。

采样状态测试临时绑定真实hardware texture读取gl.getTexParameter后恢复绑定；用setVerticesData替换UV，验证U+1/V−1仍采样同一双线性颜色，再恢复UV。MipFilter设备继承尚未证明。

纹理四象限测试保留显式源UV与RawTexture `invertY=false`，验证生产shader按输入UV采样。这不是任意原资产纹理变换的全量验收。

## 透明度合同

Web shader将输出alpha量化为 `floor(color.a * 255 + 0.5)`，再按原脚本AlphaRef100、GREATER进行比较；实际100/101边界都已读取像素验证。原D3D设备的内部alpha量化与舍入细节没有执行证明；本检查确认Web遵守当前八位整数比较合同，不宣称为原D3D framebuffer对照。

## 复现与证据

启动独立Chrome并保留现有Vite5173：

```bash
/home/node/.cache/puppeteer/chrome/linux-150.0.7871.24/chrome-linux64/chrome \
  --headless --no-sandbox --disable-dev-shm-usage \
  --use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader \
  --remote-debugging-port=9241 --user-data-dir=/tmp/cdtank-mv3-pixels-sol about:blank
node tests/browser-mv3-material-sol.mjs <CDP-WebSocket-URL>
```

脚本关闭自己创建的页面，释放scene、engine与canvas。完成后独立Chrome9241已关闭，原服务及其他浏览器保持运行。

证据：`recovery/output/browser-mv3-material-sol.json`。其中保留实际/预期像素、四象限采样坐标、反射与剔除结果、morph shader defines、画布尺寸与WebGL renderer/version。采样状态追加验证对应mv3-sampler-browser.log；生产入口显式配置LINEAR/WRAP。

## 未完成范围

原D3D最终像素、有效NORMALIZENORMALS/AlphaTest状态覆盖顺序、D3D量化舍入、雾与场景灯、自定义角色效果、全部源纹理坐标变换及生产高清性能仍未由本像素oracle证明。该测试是128×128有意有限shader验证，不能作为1080p/4K完整场景性能验收。
