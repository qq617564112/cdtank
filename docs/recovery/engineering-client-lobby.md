# 正式首页房间与账户入口

E-03将正式main中的房间地图/战车目录、房间刷新、密码加入、创建、CPU入口、成功后的控件/焦点和退出返回收进interface/lobby/room-controls.ts；我的家三个窗口及音量控制归interface/lobby/account-controls.ts。main只组装Babylon场景、相机、灯光、renderLoop与Battle，注册界面入口及全屏。

room-controls继续使用同一个Battle，不直接构造联机客户端。目录请求成功后刷新原模式地图门槛；CPU按钮busy/防重复状态、资源失败反馈/重试和正常准备仍由实际startCpuMatch处理，只有完整成功后隐藏大厅和设置canvas焦点。加入/创建保留密码清除时机与错误反馈；返回调用原battle.leave，再恢复原界面。没有额外自动准备、第二份房间状态或新的页面框架。

account-controls每种窗口只构造原有实例，使用Battle同一已认证账户会话；音量继续委托Battle，无账户/资源实现复制。控件ID、HTML、原布局和样式保持既有合同。main规模29行不作为验收门槛，实际创建/资源/返回链路才是本片验收。

## 验收入口

正常CPU首页无查看器/目录请求、失败重试/准备/实际地图战车/CPU运动/返回：engineering-lobby-cpu.log。正常创建/原Ready与Cancel/双向换队/退出：engineering-lobby-rooms.log。我的家装备鼠标/键盘/拒绝/隔离/1080p与4K/刷新和服务重启/关闭清理：engineering-lobby-equipment.log。

正式Web独立构建、全仓类型、208正式可达模块边界：engineering-lobby-{build,types,boundaries}.log。编译真实账户迷彩联机重启保存与CPU五模式各两局：engineering-lobby-compiled.log。本片以上命令全部退出0，业务夹具PASS；正式Web构建在1分36秒完成。构建仍提示主包较大，当前切片不宣称加载体积或高清性能优化完成。不把源码迁移或命令启动当验收。

E-03仍需整理Battle中的实际对局生命周期与生产资源/渲染职责；当前大厅与我的家已经有明确功能模块，资源工具及全部诊断入口分离。此片不是原完整大厅/全部界面复刻或全内容高清对局证明。
