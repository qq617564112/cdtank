# 原表情选择 Web 业务验收

运行 `npm run test:chat:emotes:browser`。脚本使用独立服务器3204、Vite5236、Chromium CDP9306、临时账户数据库和浏览器配置。两名普通账户同队，添加敌队CPU后正常准备进入PLAYING。

普通鼠标点击原btnExpandEmotion打开三十项选择列表。对照game_main_emotelist.xml的32源控件核对三十表情项的矩形、PNG和194×134九切片框，菜单采用源根x89/y-7定位。核对按钮Normal/Hover/Pushed资源、1080p及4K截图。

选择1、6、30插入原Unicode符号U+2580+编号，验证中文光标中间位置、插入后光标和选区内容保持。选择不自动发送；72字符满值明确拒绝且内容不变，71字符可再插一个符号。普通手输/01至/30全串转为符号，/00、/31保留原文。

普通Enter真实发送多表情中文消息，二进制RoomChat请求、成功确认和双方事件核对完整符号消息及发送者身份。日志使用data-chat-text保存完整文本；验证文字节点与img.alt重建同一消息，三十base静态图片均实际加载解码，不依赖textContent判断图片消息。F5回归当前队伍频道；真实Chromium预编辑期间表情按钮不打开列表。个人模式队伍频道真实拒绝，保留中文和符号草稿。发送期间按钮禁用，响应后恢复；退出后重新创建WAITING房间清空菜单、草稿和日志。

## 验证边界

原CEGUI RichEditbox解析器和动态图字体仍属未完成父项。本项输入框显示原Unicode符号，日志显示来源base001至030的静态PNG；不是原动画或原输入字体像素。全串缩写转换、光标前缀回置和72字符拒绝是明确Web适配。TSRPC传Unicode内部符号，不声称复用原发送A262至A27f字节或原接收标签协议。CDP预编辑不验证操作系统输入法候选窗口。

证据保存为 `recovery/output/browser-chat-emotes.json`、`.log`及同名前缀PNG。只读取资源就绪状态，无对局或回包注入。结束关闭专属服务器、Vite和Chromium，删除临时目录。
