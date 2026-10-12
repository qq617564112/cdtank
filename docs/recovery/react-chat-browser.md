# E-R04-C React聊天浏览器验收

`tests/browser-react-chat.mjs`使用独立3272服务、5302Vite及9502Chromium，普通输入操控同一正式React应用中的两账号。输出每次独立时间前缀。`--continuation`复用既有完成的首段，执行普通房间准备、表情/动画、滚动、高清和离场重入后段。

## 验收范围与失败假设

- 界面/控制器拆分可能丢失已确认消息、频道或pending状态：双端WAITING与PLAYING普通公共、队伍与F5快捷消息，核对真正TSRPC请求、应答、双方RoomEvent、身份与频道。
- 受控输入或组合事件可能吞中文、提前发送或丢caret：真实Chromium IME候选/提交Enter隔离，以及原生鼠键在中文中间连续选择1、6、30表情，核对caret、草稿、菜单保持及只在普通Enter发送。
- JSX原布局和资源可能偏移：实际1080p/4K源矩形、PNG与九宫格、频道菜单锚点及Normal/Hover/Pushed检查；混排图像核对原序列资源解码与真实自然帧。
- React滚动控件可能失去事件或资源清理：真实消息历史通过原箭头、Home/End、方向键、PageUp/PageDown、Pointer拖动、wheel，核对实际scroll/ARIA、输入隔离；离房保留旧图节点并确认detach与帧停止，重入WAITING为空且频道复位。
- 失败或晚通知可能清掉未确认草稿：普通个人模式队伍请求拒绝，核对真正失败响应、中文草稿保留和已确认日志不变。

正式聊天主体、菜单和滚动控件由React拥有；原富文本消费者仅拥有每条消息内部叶节点。Babylon场景与Battle网络、输入状态保持既有模块归属。脚本不注入世界位置、伤害、计时或胜负。

## 证据边界

首段真实业务与后段证据分别保留，最终索引只能引用实际完成的检查。历史整体FAIL保持原状态，不将部分通过改写为整轮通过。各次为独立账号/数据库，不宣称跨段持久身份。

本片不重跑五模式两局、账户重启或全部三十表情来源；原序列与原字体/XML合同沿用相关M5-12已验证来源。完整聊天的好友、密语及原服务端规则仍按各父任务登记。

## 本片交付

综合索引：`recovery/output/react-chat-2026-10-03-accepted.json`。

- 首段`react-chat-2026-10-03T16-52-18-018Z.json`的15个完成检查覆盖正常双端WAITING公共/队伍、PLAYING源布局按钮/频道、公共/队伍/F5、真实IME、连续caret插入及双端原序列图像解码。该文件整体保持FAIL；完整自然帧验证由后段提供。
- 后段`react-chat-2026-10-03T16-56-07-698Z.json`整体PASS，25个检查覆盖自然12个RAF、实际14条历史消息及所有列明滚动操作、4K源布局、旧图节点释放/停止、正常新WAITING及mode4真实拒绝保留。

实际自然12帧中，表情30从原frame2变为frame4；表情1和6随原消费者大delta进入`none`，elapsed从0.05增长至4.1497，符合既有原单次减周期规则。没有推进或冻结动画时钟。

后段末尾仅对Babylon内部3D画布设置hardwareScaling8降低软件绘制开销；界面仍使用实际3840×2160与1920×1080viewport，对应canvas480×270及240×135。独立`react-chat-2026-10-03T16-56-continuation-render-diagnostic.json`保存实际尺寸与范围。本片证明高清UI与自然动画，不以这段证明3D高清性能。

3272、5302、9502均已释放，fixture服务、Chromium、Vite及临时目录清理全部通过。

## 自然结算与再战生命周期

`--finished-only`专项`react-chat-2026-10-03T17-05-49-858Z-finished.json`整体PASS：两个人类账户明确导入`world-role-attributes-native.json`的tank1/part0原属性字段，通过普通创建mode4/map7、加入、两个CPU、Ready及本人托管自然对战。P1实际击杀10时两网页收到首局FINISHED；正常公共中文由真正RoomChat确认并同步双方。随后两人分别点击普通再战按钮，新局round2进入PLAYING，原频道菜单、受控输入及普通中文发送继续通过双端确认。首自然终局及再战验收合计61449ms，没有注入位置、伤害、胜负或时间。

该专项保持实际1080pUI，Babylon内部canvas320×180；只验证当前React结算/再战聊天生命周期，不重复两局完整玩法或3D高清性能。专项进程、端口与临时目录清理全部通过。综合索引已纳入此直接FINISHED证据。
