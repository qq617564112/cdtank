# 原地图说明换行正式验收

M5-03-R-WRAP默认wordWrap阅读排版PASS：13个原入口/Font消费向量与13个正式layout对照，实际浏览器28项检查、20张PNG。最终汇总为`recovery/output/browser-waiting-room-wrap-index-2026-10-03T22-02-58-243Z.json`，正式运行`browser-waiting-room-wrap-2026-10-03T22-00-00-595Z.json`和混合文字组件运行`browser-waiting-room-wrap-2026-10-03T22-01-22-227Z.json`均为PASS。

`node --import tsx tests/browser-waiting-room-wrap.mjs`正式PASS21。单个普通中文账户以支持的开局人数2创建原mode1/map7等待房间，800×600、1920×1080、3840×2160分别读取实际RoomSnapshot地图说明，逐值匹配完整textContent以及原行start/length、SIMSUN白字/12px/16px、183×102区域。普通Leave后创建原mode5/map21木桶击破，最长原说明与新权威快照完全一致，无旧文字。原MapInfo分别80/96高，均无纵栏。

正式组件长props fixture三种分辨率均为24行、document384，末尾换行不产生额外空行。每行DOM start/length与实际字符序列连续；source extent作为单独行字段消费。可见纵栏以173.85文字宽重排，page102，End为282；普通滚轮、箭头16单位移动、透明thumb捕获/拖动/释放通过。源箭头Normal/Hover/Pushed与外部release抑制、Tab/Enter、held-thumb普通变文归0与卸载通过。本片涉及排版后的document/滚动范围，状态与账户/Ready/两局基线复用DESC及主任务有效证据。

`node --import tsx tests/browser-waiting-room-wrap.mjs --mixed-only` PASS7。隔离props包含实际ASCII、空格、tab、CR、中文、换行与连续空段，三个真实分辨率核对行索引/字符长度/完整原文字与源区域，普通End到动态document−page并截图，普通关闭移除全部行。夹具通过生产组件和实际加载SIMSUN测量，不修改服务数据或游戏状态。

最终两个运行的server/Vite/Chrome退出、临时目录删除，3283/5313/9513无残留监听。正式800、4K拖动及混合文字代表图已观察；源执行/字体provider边界见`waiting-room-wrap-source.md`。

## 精度边界

正式Canvas provider分别供应字形右边缘与advance，原extent/max合同和原前缀advance合同分开。原Windows glyph映射/advance/ink/光栅、GPU/display及其它排版模式/编辑仍保留父缺口。tab的token行结构实际消费，DOM white-space:pre仍按浏览器tab-stop绘制，不声明其原glyph像素一致。原首字宽于区域的零拟合路径有界取证，正式采用一个字的Web裁剪前进，不让阅读停滞。该交付不声明整页1:1。

统一最终工程证据：breach21-wrap-metrics-final-web-build.log（Web类型/发行1m32s PASS）、breach21-wrap-final-boundaries.log（310正式模块PASS）；碰撞离房修复另见breach21-wrap-server-types.log/-server-build.log与breach21-room-departure.json/log。
