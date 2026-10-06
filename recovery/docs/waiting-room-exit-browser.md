# 等待室退出浏览器验收

结果：PASS。运行 `node --import tsx tests/browser-waiting-room-exit.mjs`，使用独立3195服务、5230 Vite、9300 Chromium和两个独立账户网页。

两个正常网页进入真实 WAITING，原 room_main.xml 控件位置、原按钮图片与实际 PNG 解码在1080p/4K通过。Escape只收起面板，不发送Leave且继续留在房间；原btnClose通过原生Tab/Enter执行显式Leave(roomId,round)，服务确认后离开网页清空world、等待室源节点与玩家卡并返回大厅，另一网页权威玩家列表同步移除离开成员。

大厅原生输入恢复；原账户token保留，正常Join同房没有额外Account请求，获得新成员ID并与另一端玩家列表一致。外层leave使用相同确认离房流程。证据为 `recovery/output/browser-waiting-room-exit.json`、同名服务日志与1080p/4K截图。

服务与Chromium退出、Vite关闭、临时目录删除均通过。浏览器场景未注入玩法状态，也未开始CPU对局。
