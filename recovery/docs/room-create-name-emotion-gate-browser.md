# 建房默认字体选区玩家闭环

源EmotionFont0完整房名及密码选区消费者通过13项限定验收。`browser-room-create-emotion-gate-accepted.json` 指向六项三分辨率源控件几何、六项普通房名/密码交互及一项真实成功建房/Leave/重开清理，共67张有效整页PNG。原始记录保持各自状态：01-04-41包含已完成12项三分辨率检查，整体状态FAIL；01-08-04限定成功业务段PASS1。只采索引列明的检查，不把原整体FAIL改为PASS；中断记录不采检查。

正式 `RoomCreateNameSelection` 绘前缀、selected与suffix三个片段，位置分别为−scroll、prefixExtent−scroll、prefixExtent+selectedExtent−scroll。当前SIMSUN中文字宽12，7字普通房名选区1..4显示完整“中/文房名/123”，三个起点0/12/48；背景起点12/宽36。特殊前缀AB━中文房名通过普通Home/箭头/Shift选择4..6显示完整“AB━中/文房/名”，同input值/range与普通字宽累计保持。

正式 `RoomCreatePasswordSelection` 保留type=password，7字密码选区1..4完整显示7颗原星号，视觉层只持有count/range/scroll/focus。原Password字体保持实际自定义面，源U002A与派生掩码在同浏览器Canvas的完整像素与字宽相同。background沿真实start/end×advance定位，选区不泄露明文。

800×600、1920×1080、3840×2160均实际编辑中文、真实左键多段鼠拖1..4、普通Shift箭头、CDP中文composition提交、长串selection/End横滚/Home回0、失焦灰色、pending灰色、真实CreateRoom拒绝后原输入焦点恢复与Escape卸载。WebSocket proxy仅保留实际服务器回复的送达以观察pending，不注入消息或替代返回结果；release后实际拒绝仍经正式API处理。长串为现Web32/64与native字体provider供给的滚动范围，原建房8/20长度资格已由INPUT-LIMIT单独恢复。

成功段正常编辑AB━中文成功房和中文可用密码，点击正式确认，真实CreateRoom请求与成功响应保留该原值、实际房名进入权威WAITING。成功后dialog、两选区层和native透明class卸载；普通Leave清world，再开正式dialog编辑重开中文房并以Shift产生选区，Escape后两层清理。独立3270服务、5300 Vite、9500 Chromium与临时目录均已清理。

已实际查看800特殊前缀选区与4K密码源星号选区图，完整前缀及7星号可见。旧 `--name-selection-only` / `--password-selection-only` 验收命令维护相同源font0断言；本轮经共享 `--emotion-gate-only` 路径执行两个分支，`--emotion-gate-success-only` 仅补成功业务，未重复其它控件/五模式/账户。

工程共用 `breach20-emotion-gate-web-build.log`（Web类型/唯一生产构建1m37s）和 `breach20-emotion-gate-boundaries.log`（313模块边界）。root独立native和页面复核保存room-create-emotion-gate-root-native/root-browser.json。

## 限制

本片证明原默认字段和限定实际setup保持EmotionFont0及其正式玩家显示闭环。完整XML loader/virtual hook、任意后续EmotionFont赋值、非零EmotionFont实际字形renderer、原OS字体/候选窗、逐值scroll与GPU/framebuffer等价未执行。原房名8/密码20输入资格由INPUT-LIMIT独立恢复；本片历史长串不作为原建房输入资格。
