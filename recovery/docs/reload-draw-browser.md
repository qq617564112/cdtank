# 原装填条正式网页验收

`browser-reload-draw-2026-10-04T00-48-00-356Z.json` PASS5，原灰/黄RGBA差分PASS；`browser-reload-draw-fourk-2026-10-04T00-51-24-071Z.json` PASS2提供真实可见full的4K局部及整页图。验收索引为 `browser-reload-draw-accepted.json`。

正式 React `prgCrossbar` 使用原77/47背景与77/48黄色进度图、Vertical整数物理clip、原自动缩放取整后图片平铺及窗口Alpha0.6。颜色均为80FFFFFF，进度纹理保留原RGB；原ColorRect有效alpha覆盖颜色alpha，子图片opacity为1。

`tests/browser-reload-draw.mjs` 创建两个独立普通账户的mode1/map7房间、普通加入、添加两CPU、等待实际资源加载、普通Ready进入PLAYING。账户属性沿用已经执行的原tank1/part0记录；没有位置、生命、装填、事件或时间注入。内部3D hardwareScaling6用于软件渲染预算，UI视口保持实际尺寸。

800×600、1920×1080、3840×2160各用普通Space开火，实际PlayerInput.fire与权威reload.startedAt/duration/source进入正式消费者。各尺寸记录部分装填、完成和下一次普通Space成功更新装填起点，核原50×37矩形、Vertical底部锚定整数extent、取整图片尺寸及重复平铺，保存partial/full请求时的整页PNG，截图期间普通时钟继续推进；整页图片不被解释为冻结的请求前fraction。800原局部crop用于精确partial/full颜色差分，大尺寸原绘制状态与几何另以实际记录验收。连续装填反馈仍由ReloadControl独立订阅，不逐帧推根HUD。

800尺寸另外直接捕获页面原装填准星所在50×37 crop，不改变DOM、战斗或时间。原同一位置(14,6)背景opaque灰[84,85,84]与进度opaque黄[255,255,0]在普通静止玩家的partial/full截图中比较：实际差分符合Alpha0.6×源RGB差分，容差每通道5用于真实场景背景随自然帧的变化。该差分能区分子图额外128/255 alpha的旧混合。大尺寸实绘和几何分别验收，没有声称每尺寸所有进度逐像素等价。

随后双方普通开启autopilot，以真实CPU战斗观察本地自然死亡时fraction1、hidden=true，以及同一玩家自然复活恢复可见原条。实际网络destroy/respawn随证据保存。两页普通Leave使world清空、HUD隐藏、reload恢复fraction1且hidden=true；停止只读观察时钟。 独立3287/5317/9517服务与临时账户目录全部清理。

4K补充用普通Space观察新部分进度，再等进度1后直接捕获实际180×133原条及整页；capture前、crop后和整页后均为alive=true、hidden=false、fraction1。已实际查看800部分原条crop与4K完整原条crop，分别显示底部黄色部分和完整黄色源形状。

集成复用root必要Web类型/唯一生产构建1m41s、313模块边界、原27 Crossbar RGBA与32/108 life规则PASS，日志为reload-draw-web-build.log、reload-draw-boundaries.log、reload-draw-rules.log、reload-draw-life-rules.log。

## 限制

本片闭合原装填条的正式源图/alpha/整数裁剪和玩家反馈，未恢复原完成观察者生产入口、完整UI frame dispatcher或原phase gate。首快照elapsed补偿与现业务visible规则继续保持已登记重建同步。没有Windows GPU/framebuffer等价或大视口3D性能结论。历史未通过文件保留，最终验收索引只引用整体PASS。
