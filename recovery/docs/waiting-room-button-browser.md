# 等待房间原按钮正式页面验收

`node --import tsx tests/browser-waiting-room-button.mjs` 正式结果PASS7，三个分辨率各22个实际按钮状态样本（合计66），40张PNG。`recovery/output/browser-waiting-room-button.json` 保存逐层比较、真实网络、焦点与cleanup；server/Vite/Chrome独立端口全部释放，临时目录清理。沿两个独立普通网页创建/加入同一WAITING，在800×600、1080p、4K核对实际共享source按钮子层。原执行oracle为 `waiting-room-button-native.json`，共用建房窄回归命令为 `node --import tsx tests/browser-room-create-visual.mjs --button-shared-regression`。

Ready/Cancel/Team/Invite/Close逐项比较原状态层顺序、源asset、computed图片、opacity1和目的框。captured鼠按拖出/外释放不准备，返回释放只准备一次；Space取消准备，Tab/Enter换队，两个真实快照确认结果。pendingReady/Close无custom图片，Invite保留Disabled图片，Team disabledselected为Disabled+CheckMark。真实无大厅收件人RoomInvite拒绝经原notice呈现，关闭notice沿既有WaitingRoomSession规则恢复可用Invite或回退Ready焦点，逐轮记录实际目标（本轮三组均为Invite）并恢复Invite可用；busy期间不重复发请求。

按住鼠键Escape关闭等待面板释放source控件，重开无pressed残留，WAITING房间保持；最后两端通过原Close执行普通Leave，world/面板/控件清理。800×600沿既有等待面板滚动到按钮交互区域；full page/frame/font/scale精度不由本按钮片验收。

共用建房窄回归PASS2，800×600保留29个实际按钮状态样本及正常请求、pending拒绝、held关闭/重开与cleanup证据，输出 `browser-room-create-button-shared.json`。
