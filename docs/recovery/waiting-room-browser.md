# 原等待房间浏览器验收

最终PASS：两个独立正常网页、17项检查、五张截图。两位真人普通Ready进入PLAYING，普通Leave清空原面板；专用服务、Vite、Chromium和临时目录已全部清理。

运行 `node --import tsx tests/browser-waiting-room.mjs`。脚本使用独立服务端3192、Vite5227、Chromium CDP9297、临时账户数据库和两个独立浏览器上下文。

两个普通网页通过正常账户、建房、房间选择和加入进入同一团队房间。鼠标及原生Tab/Enter操作原等待面板，Ready、取消准备、ChangeTeam和Leave均调用普通网络请求。二进制WebSocket请求、响应和RoomSnapshot按实际协议解码。

验收内容：

- 原`room_main.xml`控件累计坐标、十二个PlayerPanel槽位、固定及按钮原图裁片和PNG解码；1080p与4K下控件可见。
- 两页姓名、当前队伍、准备标记与服务端快照逐项一致；准备和取消均等待权威确认。
- 当前队伍禁用，已准备后两队禁用；取消恢复对侧队伍；请求pending期间准备及两队操作均禁用。
- 原生键盘Ready、换队和关闭/重开流程，确认后焦点仍可继续操作。
- 实际WAITING打开面板时W、Space、Digit5不产生PlayerInput、RoomChat、Ready或ChangeTeam请求。
- 两真人普通Ready自然进入PLAYING并关闭两页原等待面板；普通Leave清空原面板及房间状态。

证据写入 `recovery/output/browser-waiting-room.json`、`.log`及同名前缀PNG。脚本不注入房间、队伍、准备、位置、生命或胜负数据；结束时关闭专用服务、Vite和浏览器，并删除临时目录。保留3001/5173服务。

## 恢复边界

槽位使用重建服务端快照按队伍投影至两侧各六位。坦克图标使用已恢复`tanke0`原裁片，以重建快照的tankId映射至原资源编号；未复现原客户端角色定义和房间槽位数据来源。姓名和准备图标有实时权威数据。未恢复原头像及称号定义，测试不以新账户证明原角色配置或原服务器开局权限。
