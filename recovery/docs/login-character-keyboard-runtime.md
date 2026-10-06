# 原Login字符键盘采用

对应UI-28/M5-01/M5-16。LoginSourceView的密码框获得焦点时挂载原`keyboard.xml`字符键盘，逐项消费源55控件与47键映射（[来源](login-character-keyboard-source.md)）。当前Web仅普通认证模式，无QQ producer；原QQ→Q抑制事实留来源边界。不新增模式flag，不伪QQ支持，不改输入协议/账户服务/频道业务。

## 挂载与生命周期

键盘消费者`SourceCharacterKeyboard`位于登录stage内，与Login共用现`SourceImageScale`/`scale`。以`useSourceUi(true, ['keyboard.xml'])`独立加载，根`all`在401,86–793,224，继承stage一次缩放，不二次叠加401/86父offset。资源loading/error以局部状态/重试呈现，仅键盘重挂载，不重置账号、密码或登录phase，不阻塞其它Login按钮。

打开：密码框focus或pointer按下时置open。关闭：账号/登录外pointer、键盘失焦到外部、Escape或Login卸载时关闭，并清除Shift/Caps（状态随会话组件卸载）。键盘内部焦点移动不关闭。Escape回password目标并用一次性抑制位避免立即onFocus复开；密码框重新focus可再次打开。

## 47键映射与状态

按钮按源`characters`映射逐项查表（`source-character-keyboard-map.ts`），不使用KeyboardEvent猜字符。Shift!=Caps时取upper，否则取lower；字符插入后Shift置false，Caps保持。Shift/Caps为独立源checkbox三态绘制：常态/悬停plate加单独CheckMarkImage选中层。它们只改变键盘自身状态，不改物理caps。

## 输入目标

点击字符先恢复该Login实例passwordInput焦点，沿当前selectionStart/End替换选区后推进caret；沿用现`useRoomInputLimit`的20 codepoint规则，字符点击溢出拒绝且保当前文本与选择。物理键输入、剪贴板、浏览器composition继续现输入路径。不向账号/聊天输入，不submit/login/register，不写localStorage/日志/报告密码。保存与认证仍唯一经父`onLogin`/`onRegister`。

键盘Tab/Enter/Space可激活源按钮；字符按钮非submit类型，父form Enter不从按钮重复提交。

## 未实测范围

未运行网页/HD/键盘/真实认证/保存验收，也未做浏览器或键盘实测。原QQ模式producer未恢复，仅普通密码activation挂载。UI-28/M5-01/M5-16父项保持未勾。
