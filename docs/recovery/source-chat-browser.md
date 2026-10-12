# 原战斗普通聊天浏览器验收

运行 `node --import tsx tests/browser-source-chat.mjs`。独立服务器 3203、Vite 5235、Chromium CDP 9305，临时账户数据库和浏览器目录。

两名普通页面账户创建、加入房间并加入同队，添加一名敌队 CPU 后普通准备进入 PLAYING。验证原普通聊天布局五层背景、edtDisplayBox、edtChat 和同位置择一显示的 btnPublic/btnTeam。原按钮点击打开 game_main_channellist，保留当前频道并清空选择；点击 rdoPublic/rdoTeam 后切换按钮、关闭列表并聚焦输入。

普通 Enter 的中文公共与队伍请求均核对唯一请求、成功确认、发送者身份及双方一致事件；设置中的 F5 使用当前队伍频道。一段实际 Chromium imeSetComposition/insertText 验证候选 Enter 不误发、提交后普通 Enter 可发送。个人模式选择队伍频道收到真实 CHAT_REJECTED，保留中文草稿；发送期间原频道按钮禁用，完成后恢复。

1920×1080 和 3840×2160 核对原舞台 800×600 的居中统一缩放、聊天根 y435，以及源控件 AbsoluteRect。原背景 PNG、上面板九切片和按钮 Normal/Hover/Pushed 资源均与 ui.json 对照。频道菜单以聊天舞台 x2/y10 锚定，内部原根偏移归零；此定位为当前适配。退出原舞台并重新创建等待房间后核对清空日志、草稿、菜单和恢复公共频道。

## 验证边界

Web 公共0、队伍1适配原本机频道1、5，当前服务端同房/同队路由不代表原服务器协议已恢复。好友、密语、GM 三项保持禁用；原滚动条和表情尚未恢复。CDP 验证浏览器组合输入，不驱动操作系统候选窗口。

证据：`recovery/output/browser-source-chat.json`、`.log` 及同名前缀 PNG。结束时关闭专属进程并删除临时目录。仅读取资源就绪状态，无对局或协议回包注入。
