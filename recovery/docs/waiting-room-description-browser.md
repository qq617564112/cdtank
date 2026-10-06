# 等待页地图说明正式阅读验收

M5-03-R-DESC有限阅读/滚动范围验收PASS：26个原消费向量和2个原构造默认值，36项实际浏览器通过检查，14张选定PNG。汇总证据为`recovery/output/browser-waiting-room-description-index-2026-10-03T21-41-49-107Z.json`，按phase列出原运行文件与所选check索引；原文件的运行状态及既有失败证据完整保留。

两个独立普通中文账户通过正式建房/Join进入WAITING。800×600、1920×1080、3840×2160逐项核对原183×102区域、padding0、overflow裁剪、SIMSUN12px/16px白字，以及将实际行文字拼接后与解码RoomSnapshot.roomInfo.mapDescription逐值比较。三个分辨率均通过普通Ready/键盘取消、阅读区W/上下/Home无PlayerInput、Escape卸载/普通重开位置0，以及两端真实Close/Leave。

正式原地图mode1/map7说明为5行80高；普通新建mode5/map21木桶击破为6行96高，均在102页高内，不显示纵栏。最长原地图文字与权威快照完全相同；没有改写地图数据来制造溢出。实际截图分别来自`21-31-41-492Z`前三res和`21-36-50-706Z`最长原地图phase。

## 长说明实际交互

`node --import tsx tests/browser-waiting-room-description.mjs --fixture-only`输出`browser-waiting-room-description-2026-10-03T21-39-18-792Z.json` PASS16。隔离的`__description-fixture`路由仅以普通props向正式SourceMultilineReading提供长中文段落，使用正式原布局、SIMSUN、组件和CSS，未注入游戏或服务状态。

实际800/1080p/4K的25行document400均核对173.85文字宽、9.15纵栏、page102、源26/27高箭头、原thumb比例/minimum和透明背景/真实命中。每个分辨率执行普通Home、滚轮、下箭头到16、End到298、透明thumb实际捕获/拖动及释放，并截图顶部和拖后位置。

800实际源下箭头Normal/Hover/Pushed图片136/137/138逐态核对并截图；held inside为Pushed，captured移外为Hover，外部release恢复Normal、释放capture且不执行滚动。普通Tab/Enter上下箭头移动一个16单位源行。held透明thumb期间普通键盘切换夹具说明为短说明，捕获释放、位置归0，随后旧指针移动/release保持新文字和位置。另一held透明thumb期间普通键盘关闭夹具，阅读节点和滚动控件卸载。正式普通房间关闭/重开另由权威业务phase验证。

代表正式800、最长原说明4K、夹具800箭头pushed及4K拖动截图已观察。三段运行server/Vite/Chrome退出、临时目录删除；隔离端口3283/5313/9513已释放。统一Web类型/构建和310项模块边界检查由主任务运行并通过，日志为`waiting-description-t01-web-build.log`及`waiting-description-t01-boundaries.log`。

## 精度边界

此验收证明正式地图说明阅读消费者、源滚动栏及普通交互。长文本溢出属于明确组件props夹具；DOMwheel单位桥接、canvas字宽和当前Webscale为适配。原wordWrap formatText专项与正式接线验收见`waiting-room-wrap-browser.md`；caret/selection编辑、其它排版模式、原Windows字形/像素及GPU/display父缺口保持；原执行/provider边界见`waiting-room-description-source.md`。
