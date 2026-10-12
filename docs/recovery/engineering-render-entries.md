# 渲染验证与资源查看模块边界

所有既有渲染验证HTML及对应诊断源码从apps/web迁入tests/render，使用实际生产渲染模块。独立产物位于dist/validation，正式产物仍为dist/web；原目录不保留副本或兼容入口。正式main的模型/地图查看控件和资源生命周期收拢到assets/asset-viewer.ts，主入口通过suspend/resume协调对局切换。main为172行，查看器为123行。

| 独立入口 | 开发命令 | 默认端口 | 浏览器夹具 | 地址覆盖变量 |
| --- | --- | --- | --- | --- |
| effect | render:effect:dev | 5206 | browser-effects.mjs | CDTANK_RENDER_EFFECT_URL |
| effect-particle | render:particle:dev | 5207 | browser-effect-particles.mjs | CDTANK_RENDER_PARTICLE_URL |
| effect-overlay | render:overlay:dev | 5208 | browser-effect-overlay.mjs | CDTANK_RENDER_OVERLAY_URL |
| skill-effect | render:skill:dev | 5209 | browser-skill-effect.mjs | CDTANK_RENDER_SKILL_URL |
| effect-camera-shake | render:shake:dev | 5210 | browser-effect-camera-shake.mjs | CDTANK_RENDER_SHAKE_URL |

命令使用npm run；将dev改为build即执行对应独立构建。模型和闪电先前分别迁至effect-model和effect-bolt，端口5204/5205，详见engineering-render-entry.md及engineering-bolt-render-entry.md。每个夹具接收CDP浏览器WebSocket参数，使用独立根页面地址。

正式运行依赖检查遍历main/index的静态依赖，并检查七个已迁移的HTML/诊断源码不留在正式目录。渲染验证不进入正式入口的模块依赖树。生产共享渲染模块仍在客户端源码；它们不是取证或验证代码。

资产查看器仍在正式页面加载。将资源查看页面完全移至开发工具入口，需要同时整理现有页面、对局返回行为及相关夹具，属于E-03后续切片；本次已隔离所有现有专用渲染诊断入口，并抽出资源查看职责。

迁移后的五项独立浏览器验收均通过：通用爆炸16帧/混合深度/时钟，粒子七步寿命/顺序/运动/释放，覆盖层19原样本及生产源树，技能原树/GA35音频/持续与队列/释放，相机原矩阵/RNG/到期恢复。技能验证显式注册GLTF加载器，独立入口不依赖正式main的副作用。日志为engineering-render-{effect,particle,overlay,skill,shake}-browser.log。

真实业务回归通过：原地图0002/0001/0010矩阵（engineering-viewer-scenes.log）、正常CPU一键入口/加载失败重试/准备/返回（engineering-viewer-cpu-entry.log）、账户装备鼠标键盘/拒绝/隔离/刷新重启/1080p4K预览（engineering-viewer-equipment.log）、CPU五模式各两局（engineering-render-cpu.log）。正式Web构建和176模块运行依赖边界通过（engineering-render-web-build.log、engineering-render-boundaries.log）。

独立effect/particle构建的成功退出及产物清单记录在engineering-render-effect-particle-build.json；overlay/skill/shake构建日志为engineering-render-{overlay,skill,shake}-build.log。最终类型与运行边界记录在engineering-render-final-types.log、engineering-render-final-boundaries.log。
