# 好友频道正式页面状态验收

`browser-friend-channel-page-accepted.json`接受大厅已完成5范围和实际战斗5范围。大厅来源`browser-friend-channel-page-2026-10-04T08-05-40-140Z.json`的已完成检查；战斗来源`08-08-55-546Z.json`最终完整PASS10。原FAIL文件保留，接受范围不把整次FAIL改写成PASS。

大厅普通资料AddFriend准备真实单向关系。普通源频道按钮→Friend，好友标签与菜单显示、普通edtNormalUserInput/picNormalChat且无密语对象。Escape关闭回btnFriendChannel、点输入框关闭菜单，真实Input.imeSetComposition/Enter没有发送FriendChat，提交后焦点仍在中文输入。800×600/1080p/4K同前缀`-lobby-800/-lobby-1920/-lobby-3840.png`完整实际画面已查看。普通中文Enter消息送达另一真实账户，网络请求只含text。

四个普通认证网页分别源选R1→快速进入→正常准备进入PLAYING；sender与recipient为已建立关系的两账户。源Friend选择channel3，显示btnFriend及rdoFriend菜单，其他频道按钮隐藏、输入为edtChat且不显示密语目标。Escape回btnFriend，点输入区关闭菜单，输入法Enter不发送且中文焦点保留。最终同前缀`-battle-800/-battle-1920/-battle-3840.png`完整实际战斗已查看；47×25源Friend按钮按1/1.8/3.6缩放。普通中文发送被真实好友网页显示，解码FriendChat含text、roomId=R1、round=1。

3330/5354/9554专用服务/Vite/Chromium和临时目录全部清理。此前两run完成大厅范围后分别在夹具CPU可用性与队伍已选状态等待处结束，不涉及频道生产改变；最终4人普通对局通过。脚本使用独立Vite cache，只为软件预算降低场景渲染像素，源UI尺寸与普通输入保持。

## 限制

本项是新增Friend状态与交互。正式大厅父框整页既有M5-02-R-PAGE与lobby-source-page证据继续沿用，未重复全频道/父框取证。当前大厅实际背景呈大幅模糊猫图，战斗800右侧已有重建管理框；这些现有整页表现不由新增Friend状态修复或据此关闭父项。好友路由权限/拒绝/非好友隔离及其他阶段完整业务见本轮业务专项。GM、原字体/GPU精度仍未恢复。
