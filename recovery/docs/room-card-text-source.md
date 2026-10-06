# 房间卡片名称与人数原文字消费者（M5-02-C-TEXT）

正式 `RoomCards` 的 `txtRoomName`、`txtTeam0PlayerNumber`、`txtTeam1PlayerNumber` 与 `txtPlayerNumber` 使用既有 `SourceStaticText`。四控件保持 `roomlist_icon.xml` 原矩形，消费默认 SIMSUN、四角白色、显式 HorzCentred、默认 VertCentred 与文字区域裁剪。房名完整文本及 title 保留，队伍人数来自正式 ListRooms 的 teamPlayerCounts，个人人数来自 playerCount。

`room-card-text-source.py` 将四个原 WindowsLook/StaticText 布局属性绑定到已执行的 `waiting-room-static-text-native.json`：原应用 `0x454202..0x454236` 设置 System 默认 SIMSUN；Window::getFont `0x10030e50` 在没有显式 Font 时取得 System 默认，未读取父控件字体。StaticText 构造 `0x100b1580` 写 LeftAligned/VertCentred 与四角 FFFFFFFF，WLStaticText 没有覆盖默认。四控件均没有 Font/TextColours，均显式 HorzCentred，故使用同一原消费者。原 drawSelf `0x100b0db0` 的垂直位置、格式与 Rect 交集裁剪执行证据复用上述来源，不重复字体或 OS 取证。输出 `room-card-text-source.json` PASS 四控件。

房名矩形为 (15,26)-(110,42)，95×16。两队人数各为父底图 (31,5)-(61,17)，30×12；个人总人数相同。`HomeSourceLayout` 将父子位置转换成卡片坐标。卡片 stage 的现有比例传给 SourceImageScale，以选择现有 96/103/192 DPI 原 SIMSUN mono atlas。已知字符使用原字形、advance、baseline 与 ink；字号、行距和定位沿用既有源文字消费者。卡片通用 span 图片样式仅作用于直接子节点，避免修改内部 glyph 的裁剪与背景。

共用 SourceStaticText、字体资源和等待页没有修改。当前缺人数时的「—」沿既有 Web 投影；目录房名附带模式/地图信息是现有目录投影。当前 txtRoomID 继续显示正式 R 编号，未把 MediumHT 数字资源套入 SIMSUN 或删除 R。

## 边界

有限 atlas 之外的字符使用已加载 SIMSUN Web 字体 fallback；不把未知字符称为原点阵。原完整 Windows 大厅截图、GPU/display、房间编号格式消费者和完整目录回调没有在本片恢复。三分辨率页面证据证明正式四文本接线与真实加入流程，不声明整个大厅像素等价。

## 禁用祖先 alpha

`room-card-text-alpha-native.py` 原执行 Window::isDisabled `0x10030d10` 与 getEffectiveAlpha `0x10030e60`，八向量覆盖启禁、继承启禁、父 alpha1/0.5。getEffectiveAlpha 仅读本窗 alpha、继承标志与父窗递归；disabled 不额外改变结果。输出 `room-card-text-alpha-native.json` PASS。正式卡片的 `:disabled` opacity1 覆盖全局 Web `button:disabled` opacity0.5，使同一白色源文字在满员/对战中禁卡保持原有效 alpha。窗口对象字段和输出存储是明确 provider，两个 getter 与父递归执行原代码。

卡片 existing stage scale 上限3，而有限原 atlas 最大192 DPI；最近 DPI 面的选择和投影保持资源消费者既有规则，不声明高分辨率完整原 AutoScale/字体重生成。
