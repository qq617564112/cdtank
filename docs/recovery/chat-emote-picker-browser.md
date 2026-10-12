# 原表情列表保持打开浏览器验收

运行 `node --import tsx tests/browser-chat-emote-picker.mjs`。专属服务器3205、Vite5237、Chromium CDP9307，临时数据库和浏览器配置目录。两个普通账户同队，普通添加敌队CPU并准备进入PLAYING。

依据 `chat-emote-source.md` 的0x4cc5cc和0x4cc471–0x4cc589，展开按钮只打开列表；重复点击保持打开。一次打开后连续普通鼠标选择1、6、30，每次保留菜单、聚焦输入、光标增加1，并在中文光标位置插入单一码点。选择期间不发送RoomChat；普通Enter唯一发送，核对成功响应、双端同消息及实际解码的来源base图片。

菜单项获得焦点时Escape关闭并恢复展开按钮焦点；普通外部画布点击关闭。发送期间展开按钮和全部选择项禁用，服务端确认后恢复。真实Chromium预编辑期间普通指针点击不能打开列表，候选Enter不发送；Input.insertText提交后恢复普通展开和选择。离场后创建WAITING房间清空菜单、草稿和日志。

证据为 `recovery/output/browser-chat-emote-picker.json`、`.log`及1080p截图。脚本检查通过后关闭专属服务器、Vite和Chromium并删除临时目录。

## 验证边界

此项验证原列表展开与连续选择业务，日志记录当前静态base图适配；不验证原RichEditbox解析器、动画帧、4K或完整三十项资源。CDP验证Chromium组合状态，不驱动操作系统候选窗口。TSRPC传Unicode符号，不声称复用原表情字节协议。
