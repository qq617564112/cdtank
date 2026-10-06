# 原通知弹窗浏览器验收

结果：PASS。运行 `node --import tsx tests/browser-source-notice.mjs`，使用独立3201服务、5233 Vite、9303 Chromium，单正常认证网页进入mode1/map7 WAITING。

原Invite真实发送请求且得到INVITE_EMPTY，notify_dialog.xml弹窗显示服务拒绝原因。1080p/4K核对六原控件矩形、上下九块共18源框图、20px框边与PNG实际解码；原OK正常、悬停、按下图均通过。txtMessage为只读纯文本并可滚动；无图picBackgroundMask保持隐藏，输入隔离由浏览器modal/backdrop承担。

鼠标OK、原生Enter、Escape关闭通知后均恢复相同WAITING父面板及Invite焦点。通知期间父Ready鼠标点击不能发出请求；聚焦通知文本后的W/Space/Digit5不发送玩法或房间动作。通知关闭后正常Add CPU继续生效，原退出房间清除通知源节点与过时弹窗。

证据为 `recovery/output/browser-source-notice.json`、服务日志与1080p/4K截图。服务、Chromium、Vite与临时目录均已清理。
