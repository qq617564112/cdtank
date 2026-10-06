# 选定战车组件纹理材质（M3-03）

`applyMv3Materials(scene, meshes, textureOverride)` 接收调用方明确选择的组件纹理，以它替换普通 MV3 的首纹理。原 `dipan.TGA` 等非空未解析名称同样接受这一 actor 覆盖；没有选择时仍保留原缺口，不推断皮肤 ID 或默认皮肤。依据为 role-skin-texture-sol.md 的原 `gbActor::SetTexture → actor render → model render` 第三参数合同。

每次调用按本组件原材质对象创建独立 ShaderMaterial，同一组件多个 mesh 引用同一原材质时共享一个替换。不同动作/角色调用的材质状态独立，纹理资源可以共享。已转换的 originalMV3 ShaderMaterial 在明确换肤时按原 17 参数及 opacity 重建，保留环境光、geom_t alpha100/GREATER、LINEAR/WRAP 和原 cull/depth 路径。POL/CVD 及未标记效果材质保持各自路径。

返回的新材质由动作 AssetContainer 登记并释放。替换旧材质使用 `dispose(false, false)`，不释放借用的原纹理或选定纹理；选定共享纹理由调用方管理，不登记到动作 container 的 `textures`。动作容器释放材质同样保留借用纹理。运行选择与异步动作应用由 TankView 管理。

## 验证

```sh
node tests/browser-tank-texture-material-sol.mjs <CDP WebSocket URL> http://127.0.0.1:5199
```

实际 WebGL framebuffer `gl.readPixels` 验证选定蓝色纹理替换旧红色纹理，另一实例保持红色；同一实例切换绿色时另一实例保持红色。非空未解析旧名在无选择时保留原材质，有明确选择时绘制选定纹理。17 原参数及 opacity 保持，选定纹理 alpha100 丢弃、alpha101 混合，采样为 LINEAR/WRAP。动作容器释放后借用纹理继续 ready，存活实例继续绘制原颜色。证据为 `recovery/output/browser-tank-texture-material-sol.json`。

## 范围

这是网页组件材质应用及资源所有权验证。账户纹理选择来源、TankView 异步生命周期、真实角色动作和原 D3D framebuffer 由对应切片验收。
