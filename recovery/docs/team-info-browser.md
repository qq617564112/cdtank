# 团队存量HUD浏览器验收

结果：PASS。运行 `node --import tsx tests/browser-team-info.mjs`，使用独立3200服务、5232 Vite、9302 Chromium及两个普通认证网页。服务测试运行参数 `MATCH_TIME_LIMIT_SECONDS=60`；未注入位置、HP、伤害、胜负或战斗状态。

普通mode1/map7建房、Join、添加两只CPU，并等待四角色模型与动作资源载入后通过原等待室Ready开局。WAITING隐藏存量；PLAYING两队初始存量30/30。CPU正常开火、命中与击毁实际消耗存量，两网页收到同tick服务快照。60秒自然结束时tick1186为猫25/狗24，team0网页显示本队25/对队24，team1网页显示本队24/对队25。普通Rematch进入第二局并重置30/30；Leave删除两计数value和glyph，普通mode4重新进入后团队面板隐藏，完成正常离房。

1080p与4K界面核对game_main_info_team.xml全部八控件原矩形、固定蓝本队/红对队原图、BigHT乘号与数字图片引用和实际PNG解码。4K检查以1080p渲染分辨率承载场景，仅验界面布局。该显示将重建服务match.teamLives按本机team投影到恢复的两个数字槽，不宣称原客户端Info字段就是生命次数。

证据为 `recovery/output/browser-team-info.json`、同名日志及初始、变化、4K、FINISHED截图；服务与Chromium退出、Vite关闭、临时目录删除均通过。添加CPU后的模型与动作资源尚未完成时，原Ready入口合法拒绝；资源就绪是本场景的准备前提。
