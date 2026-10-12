# 我的家界面模块

E-03将库存、装备及原布局/战车预览与既有战车宠物/迷彩页面一起收拢到`apps/web/src/interface/home/`。`home-inventory.ts`负责物品列表及七快捷槽确认，`home-equipment.ts`负责部件/装饰/标记的选择、确认和拒绝处理。`home-source-layout.ts`读取原布局和图集控件；`home-tank-preview.ts`管理生产TankView实例、轨道相机和关闭清理。各页面通过既有Battle账户方法复用同一AccountConnection。

`home.css`持有这组界面的布局、控件和预览样式，由库存/装备/战车页面直接导入；迷彩选择继续导入自己的样式。全局style.css保留游戏公共布局，不再承载我的家样式。迁移没有改变原控件位置、DOM选择器、账户请求、预览资源或相机算法。原预览浏览器夹具改为导入新的实际路径，不保留旧路径实现副本。

验收命令：`npm run build:web`、`npx tsc --noEmit`、`npm run test:architecture`、`npm run test:runtime:cpu-two-rounds`，以及`node --import tsx tests/browser-home-inventory.mjs <CDP浏览器WebSocket>`、`browser-home-equipment.mjs`和`browser-home-roles.mjs`。网页夹具自行启动隔离端口及临时账户数据库，检查原图标/位置、实际确认/拒绝、账户隔离、刷新/服务重启保存、1080p/4K布局和预览、关闭释放。CDP参数应使用`/json/version`返回的浏览器WebSocket。

本片属于E-03的原界面职责整理。正式main的历史资源查看器和其余渲染诊断入口隔离、其他客户端功能模块仍待继续实施。

本片以上命令均通过。证据为engineering-home-build.log、engineering-home-types.log、engineering-home-boundaries.log、engineering-home-cpu.log和engineering-home-{inventory,equipment,roles}-browser.log；页面专题结果保留browser-home-inventory.json、browser-home-equipment.json、browser-home-roles.json，预览截图由夹具按1080p/4K输出。
