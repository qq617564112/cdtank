# 独立闪电渲染验证入口

E-03将闪电诊断页面及验证代码从apps/web迁入`tests/render/effect-bolt/`。验证继续导入实际生产的EffectSpriteMesh、EffectRuntime、闪电顶点算法与TankView，不复制渲染实现。正式Web入口没有导入该验证，旧HTML和源码已移除。

启动使用`npm run render:bolt:dev`，地址为`http://127.0.0.1:5205/`；独立构建使用`npm run render:bolt:build`，输出`dist/validation/effect-bolt`。资源仍来自recovery/output/web-assets。浏览器夹具使用`node tests/browser-effect-bolt.mjs <CDP浏览器WebSocket>`，可通过CDTANK_RENDER_BOLT_URL指定独立预览地址。

验收读取原指令生成的六组相机/矩阵/闪电条带顶点，用原纹理和GBF7渲染，比较像素、可见区域与三角索引；随后通过生产EffectRuntime实际播放原源树，检查停止后网格清理。独立验证不连接游戏服务端。

正式依赖检查同时断言旧诊断页面/源码不存在、新入口存在。完整客户端诊断隔离仍包括其他粒子、覆盖层、技能及相机验证入口，E-03保持进行中。

迁移验收通过：606原顶点与101完整材质分派，六帧浏览器像素最大误差0，生产运行网格20顶点、停止后残留网格0；独立构建、全仓类型、175模块运行边界和CPU五模式各两局通过。证据为engineering-bolt-{native,draw,browser,build,types,boundaries,cpu}.log及browser-effect-bolt.json。
