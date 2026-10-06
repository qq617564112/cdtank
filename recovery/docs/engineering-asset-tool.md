# 独立资源查看工具

E-03将模型/地图查看器实现、控件、样式与启动场景从正式Web页迁入tools/asset-viewer。正式main不再导入createAssetViewer，不再创建查看器容器或在对局进出时调用查看器暂停/恢复；正式首页移除模型和地图检查控件，保留实际房间/账户/CPU操作。

工具拥有独立index.html、main.ts、asset-viewer.ts、CSS和Vite根目录。模型导入、原材质、ScenePreview地图矩阵/资源实现仍引用生产模块，不复制渲染规则；工具可加载同一生成资产目录，无联机或账户启动依赖。默认5211严格端口，仅监听127.0.0.1；`npm run tools:assets:dev`启动，`npm run tools:assets:build`发行到dist/tools/asset-viewer，与dist/web及dist/validation分开。工具页不随正式游戏部署。

运行依赖门禁增加tools目录禁止引用、旧查看器源码不存在和正式HTML无viewer控件检查。tests/browser-cpu-entry还以实际页面DOM和Resource Timing确认正式首页不请求asset-viewer或mv3/pol/cvd转换目录，再测试资源失败重试、准备、实际地图战车渲染、CPU运动和退出。

13个既有浏览器夹具迁移：普通对局/坦克夹具只等待真实战车目录，不再等待无关模型目录；browser-scenes使用独立工具默认5211及可覆盖origin；actor-clock自启独立工具5202，通过/@fs引用正式TankView和原时钟实现。实际像素、矩阵、生命周期及对局断言保持。

## 验收与证据

正式CPU页面隔离检查和正常对局入口通过（engineering-asset-tool-cpu.log）。独立工具执行原getter11样本、60组件tick、原长帧阈值/f32及正常beforeRender/事件/释放通过（engineering-asset-tool-clock.log）。地图0002/0001/0010原放置矩阵、旋转/实际顶点和相机及0002画面记录也通过，证据engineering-asset-tool-scenes.log；工具与正式Web独立构建通过，记录engineering-asset-tool-{build,web-build}.log。全仓类型及206正式可达模块依赖边界通过（engineering-asset-tool-{types,boundaries}.log）。编译真实账户迷彩联机重启保存、CPU五模式各两局通过（engineering-asset-tool-compiled.log）。

这些验收保持既有原资源表现范围，不证明全部地图、全技能、全内容高清或实时双端完整验收。E-03仍需整理对局、生产渲染与资源其他实际职责；独立诊断/工具隔离已具备，新功能进入明确模块。
