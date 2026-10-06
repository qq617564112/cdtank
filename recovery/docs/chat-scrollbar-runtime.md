# 战斗聊天历史滚动条（M5-12-L）

正式 SourceChatScrollbar 位于 interface/battle，SourceBattleChat 在原 edtDisplayBox 上创建控件，并随 PLAYING/FINISHED 启用、WAITING/离房停用。唯一日志仍由 BattleChat 接受权威消息与裁剪；发送/频道/确认链路未另建。滚动只改变本地历史视窗，不改变消息或服务器状态。

来源见 chat-scroll-source.md/py/json。垂直条相对宽0.05、原普通图片 setter 的按钮28×26/28×27、最小滑块40、原轨道用两倍减按钮高度（94高时42）、滑块宽28、父裁剪14.3宽。上框20×28与下框20×17按源像素平铺，40高时重叠5；条背景28×21在全条平铺。滑块位置按原 page/document 比例与 scroll position/range 映射，保留短轨负 travel，不将最小滑块缩成轨道大小。

浏览器 scrollHeight/clientHeight 提供文档及页面高度，当前正式 CSS 行距16提供 step；完整原字体与混合文字布局仍未恢复，16不是原 DLL 字体常量。消息到达现调用原 ensureCaratIsVisible 的 page+lineSpacing 推进与范围钳制；WAITING 旧 Web 日志继续自动最新。浏览器 padding 给条腾出文本宽度，原 XML 解析/逐像素布局/Windows frame buffer 不因本项完成而关闭。

按钮单次步进、轨道分页、指针捕获拖动和 Home/End/PageUp/PageDown/上下键可查看历史；浏览器滚轮使用 DOM 单位，键盘和 pointer 调度为明确 Web 适配，原完整 CEGUI 自动重按调度未恢复。控件焦点/按下释放已有战斗键，历史控件键盘停止向普通战斗快捷键传播。日志和条本体共用真实滚轮消费者，主动更新相同scrollTop并阻止浏览器重复默认滚动；离场移除日志滚轮监听。自动收到消息不释放战斗键，只有历史控件用户操作释放。离场取消拖动/捕获，断开 resize/mutation/image-load 观察，隐藏条并恢复 WAITING 浏览器样式。

验收证据登记于 tasklist 的 M5-12-L。原公式执行与资源来源只证明其列明范围；必须另有实际普通消息溢出、历史操作与退出证据才能勾选玩家业务。
