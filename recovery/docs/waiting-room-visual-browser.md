# 等待页源中央框与StaticText正式验收

`node --import tsx tests/browser-waiting-room-visual.mjs` 正式PASS25，800×600、1080p、4K各核对中央9个实际图片层与10个实际StaticText，共27个图片层、30个文字节点，10张PNG。最终完整证据为`recovery/output/browser-waiting-room-visual-2026-10-03T21-04-19-500Z.json`；每次运行独立时间前缀保存，不覆盖既有证据。

两个独立普通中文账号沿正式建房/Join进入同一WAITING。房名为普通长中文字符串，房名与地图名逐值对照实际解码RoomSnapshot.roomInfo；两个名单、队伍与准备状态逐次对照双端权威快照。三个分辨率均通过普通Ready、键盘取消、Tab/Enter换队、真实无大厅收件人Invite拒绝、notice关闭后恢复可用控件、Escape关闭重开及最终两端普通Close/Leave。

实际中央层顺序和asset来自room_main原八框/中心，所有PNG独立解码；computed图片、opacity1、scaled目的矩形与源16厚/原Image圆整逐项比较。StaticText原矩形、源SIMSUN已加载、12px/16px白色、HorzFormatting/VertFormatting、overflow clip与nowrap分别验收；文字实际目的top对照原native draw输出，包含15高top−1、13高top−2。长中文房名完整textContent保持，实际scrollWidth超过105源宽并裁剪；title与可聚焦原区域保留完整名称读取。

根背景透明、无边框且padding0，源视觉不追加重建面板底色。800×600普通enabled按钮全部在视口内，elementFromPoint命中真实button；Ready、Invite、换队和Close实际执行。状态/错误条位于源visual之外，属于Web语义。源frame/字体draw边界见`waiting-room-visual-source.md`，未取得原Windows整页实截图，不将当前scale/字体投影、MultiLineEditbox或GPU/display声明为原整页1:1。

共享抽取的建房窄回归：`node --import tsx tests/browser-room-create-visual.mjs --frame-shared-regression` PASS2，`browser-room-create-frame-shared-2026-10-03T21-06-29-684Z.json`记录800×600四个实际panel的26个frame目的矩形、中心inset、源rect/PNG、button命中、关闭后frame卸载。原建房context、offset和selectors保持。

两正式运行server/Vite/Chrome均退出、临时目录删除；3282/5312/9512与3270/5300/9500没有残留监听。800源框、4K源框/白字/长名称裁剪与拒绝提示代表截图已观察。
