# 建房房名选区来源与消费

原房名 `EmotionFont` 为零时，WLEditbox绘制完整“前缀＋选区＋后缀”。三个片段沿源字体extent累加定位；背景按原start/end范围定位，caret继续按真实索引定位。正式 `RoomCreateNameSelection` 从同一个native text input读取值、range、scrollLeft和焦点，以aria-hidden/pointer-events:none层消费该显示规则，native input继续唯一持有编辑、IME、range和scroll。

`room-create-name-emotion-gate-native.py` 执行原CEGUIBase构造器字段写入 `0x1005812d..0x10058139`，将 `+0x3e4` EmotionFont清零。实际EXE建房初始化 `0x4a257f..0x4a262e` 查找 `CreateRoomDlg/edtRoomName`，存至实例+0x48，设置普通字体指针+0x104和max text length8；密码查找、普通字体、max length20及masked=true同段执行。限定初始化保持EmotionFont零。证据 `room-create-name-emotion-gate-native.json` 明确XML-loaded窗口和普通字体/getWindow/相关setter provider；源edtRoomName没有EmotionFont属性。

完整WLEditbox draw `0x1000a420..0x1000aede` 在 `0x1000a9a9` 测试EmotionFont；零指针由 `0x1000a9b1` 跳至 `0x1000aef6` 的普通前缀draw，再返回选区和后缀绘制。`room-create-name-selection-native.json` 六向量包括普通中文、失焦、长串、无选区，以及含U2501字符的font0和显式非零provider。

7字“中文房名123”选区1..4，provider每glyph7时实际为“中”@0、“文房名”@7、“123”@28。含特殊码点的“AB━中文房名”选区4..6在源font0下绘“AB━中”@0、“文房”@28、“名”@42，不因码点范围而排除原普通分支。长串按同一负scroll起点累加，背景与文字选区范围一致；长串为明确Web/native provider，不证明原建房输入长度。原初始化房名8/密码20已由INPUT-LIMIT正式消费；历史长串是独立Web/provider绘制输入。

正式前缀left=−scrollLeft，selected left=prefixExtent−scrollLeft，suffix left=prefixExtent+selectedExtent−scrollLeft；背景left=prefixExtent−scrollLeft、width=prefixEndExtent−prefixExtent。没有选区时卸载层并恢复native文字。disabled/pending沿原焦点判断变为灰选区，值与范围保持。

## 精度边界

非零EmotionFont是另一路径：U2501..U251E前缀扫描在 `0x1000aa16/0x1000aab9/0x1000ab64` 使用普通Font和EmotionFont分别绘制。该路径仅以明确非零Font provider执行，不代表建房原初始化状态；实际EmotionFont字形renderer未恢复。

原旧非零EmotionFont供给记录保存在 `room-create-name-selection-native-emotion-provider.json`。它是显式provider分支的证据，不支持源建房font0状态下省略普通前缀的结论；旧浏览器选区截图保留，但正式font0验收以当前独立索引为准。

完整XML layout loader/其virtual hook和任意后续字体赋值未执行，本片不做全程序无赋值结论。provider字宽7/line16与source text area120×16不等于原OS字体度量；正式位置使用当前源SIMSUN字体Canvas extent。原scroll逐值等价、OS输入/IME候选窗、完整字库及GPU/framebuffer仍属父项。
