# 正式建房整页实现稿

M5-02-CR / UI-07 / M5-16。归属为 `apps/web/src/interface/lobby/room-create-dialog.tsx` 与同名 CSS；草稿规则、目录导航、账户与网络由原 owner 维护。当前实现稿为 `room-create-page.patch`，尚未应用到正式源文件，等待地图04统一测试结束后落实。

原基准800×600，布局与资源沿 `createroom.xml`、room-create-visual-source.md、room-create-button-source.md、room-create-text-source.md 和既有输入消费者。保留全部主要区域、原frame、遮罩、房名、遮蔽密码、人数箭头、只读模式、友伤、确认、取消与关闭；沿普通 CreateRoom 请求和失败草稿/焦点规则。

本稿使组合输入期间的 Escape 保持原生候选取消；普通 Escape 松键关闭并经现目录导航返回原 Create 焦点。原生 dialog cancel 不提前关闭页面。确认尊重 pending 与组合输入状态，错误提示保留业务错误信息及可读资源失败状态。CSS只定位舞台直接控件，选中文字层单独保持绝对定位，共享图像内部不被页面选择器覆盖。

整页验收仍需800×600、1920×1080、3840×2160和普通地图选择→建房编辑→取消/创建/拒绝→等待与返回；包括中文候选、密码遮蔽/选择、键盘隔离、图态、命中和焦点。当前没有新增运行、截图、测试或验收结论。原回调、原OS字体/GPU、高清锚点和完整1:1来源缺口保持未完成。
