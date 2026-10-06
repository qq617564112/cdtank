# 建房输入字符上限

原建房EXE `0x4a260d..0x4a2612` 给房名Editbox设置8，`0x4a2618..0x4a261d` 给密码设置20，限定实际初始化已执行记录于 `room-create-name-emotion-gate-native.json`。原上限字段为Editbox+0x330。

CEGUI String为UTF32字符数组，`length/size` `0x10002610` 返回stored count；`utf_length(const utf32*)` `0x10002870` 每次推进4字节并计1。实际非BMP单码点计1而非两个UTF16单元。`room-create-input-limit-native.py` 的18向量执行原计数、完整普通输入回调与新文本回调：ASCII/中文/非BMP、8/20边界、满限拒绝、选区替换及新文本截断。

完整 `Editbox::onCharacter` `0x10058210` 先确认active、Font可用和非readonly，复制文字并删除选区。临时String.count若>=max，则调用Editbox满限通知，不更改原text；小于max才以count1和uint32 codepoint实际调用原String::insert `0x10006e90`，更新光标和text。因此满限中间插入也拒绝，不能先插入再删除末尾；有选区时按删除后的实际字符数判资格。

完整 `Editbox::onTextChanged` `0x10056010` 对supplied text count超限，直接把stored count设为limit，在UTF32 buffer[limit]写0。一般新文本保留前limit字符。`setMaxTextLength`设置后也会裁已有超限值，此片input取初始合法draft，普通输入与新文本分别消费上述来源。

正式 `room-input-limit.ts` 用共享 `roomInputLength/limitRoomInput`，native beforeinput只在非composition的单码点insertText检查选区删除后的剩余字符数，满限preventDefault。HTML maxlength移除，避免UTF16计数与原计数不同。React onChange对普通新值按源onTextChanged取码点prefix；composition预编辑原样保留，compositionend才提交裁限。唯一native input继续持有编辑、range、IME与scroll。

## 限制

native active/readonly、Font可用、String copy/erase/destruct/reserve和CRT memmove、validation=true、Window text assignment/通知由provider供给；实际String insert、UTF32 count和原边界/截断执行。非BMPFontavailability是明确provider，不证明原SIMSUN含该glyph。没有原Windows clipboard/IME producer执行；Web真实paste和composition提交是对原新文本回调的明确投影，不声称原CtrlV传输。服务端执行相同8/20是独立重建权威策略，未据客户端入口推原server规则。OS字体/GPU保持父缺口。
