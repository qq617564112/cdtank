# 正式大厅在线玩家区域验收

M5-02-R-PLAYERS 的真实名单呈现、选择、滚动和清理通过。root使用两个正式网页及35个普通认证连接，共37个真实在线账户验证；没有注入DOM玩家数据。

browser-lobby-presence.json完成三分辨率区域scope：800×600、1920×1080、3840×2160的PlayerList原坐标(619,155)–(789,575)、真实accountId/name与名单一致，普通点击选中使用源ui/regions/69/24.png，37个真实成员使列表实际溢出，普通wheel与End选择/滚动到末行通过。三张实际PNG保留；root已查看800右侧区域。首运行随后普通建房使该账户从另一页名单移除且清选中，通过的范围保留。

browser-lobby-presence-lifecycle.json独立续段PASS：正常双页源建房进入WAITING→大厅名单移除并清选中→源Close Leave恢复双页相同唯一账户且不恢复旧选择→普通Page.reload身份唯一→实际服务端断开双名单归零，用户可见状态显示。仅续验生命周期，不重复三分辨率、多账号与滚动操作。

## 边界与证据

首browser-lobby-presence.json整体FAIL原位保留；接受其完成的三分辨率与建房移除scope，生命周期使用完整PASS续段。汇总由root的accepted索引记录，不宣称单次整段PASS。字体光栅、14像素行高、白字与原资源拉伸行背景、浏览器滚动栏/键盘操作是明确Web投影；原字体完整度量、滚动栏消费者及Windows framebuffer完整1:1保持父项未完成。
