# 建房密码选区源消费

原 `EmotionFont=0` 的完整masked WLEditbox绘制“前缀星号＋选区星号＋后缀星号”，显示数量为完整密码长度；三个源draw片段按字体extent累加定位，背景与caret沿真实start/end和caret index定位。

`room-create-password-selection-native.py` 执行完整draw `0x1000a420..0x1000aede`，原EmotionFont0 gate在 `0x1000a9b1` 跳至 `0x1000aef6` 普通前缀绘制。四向量保存在 `room-create-password-selection-native.json`，复用原masked默认/U002A及建房masked=true入口，见 `room-create-password-source.md`。7字密码选区1..4实际为1颗前缀@0、3颗选区@7、3颗后缀@28；背景x7..28，caret x28。长串按同一负scroll起点累加，为Web/native provider，不证明原长度资格。原建房长度8/20已由INPUT-LIMIT正式消费；历史长串是独立Web/provider绘制输入。

完整源资格由 `room-create-name-emotion-gate-native.json` 限定证明：构造器将+0x3e4 EmotionFont清零，实际EXE `0x4a257f..0x4a262e` 查找房名/密码、普通字体+0x104、长度与密码mask设置，保持EmotionFont0。源createroom控件没有EmotionFont属性。普通Font/WindowManager/XML-loaded窗口和setter provider分别明示。

正式 `RoomCreatePasswordSelection` 只读取同一个native password input的长度、selectionStart/End、scrollLeft、焦点及源星号字宽。选区存在时隐藏native文字与原生选区颜色，aria-hidden/pointer-events:none层从−scrollLeft绘完整count星号；背景left=start×advance−scrollLeft、width=(end−start)×advance。三片段颜色相同，连续完整星号消费与原三draw相等。没有选区时卸载层，恢复native掩码。visual层只持有数量/范围，不显示或保存明文；native input唯一持有编辑、IME和scroll。

活动底色607FFF、失焦/disabled底色808080，文字白色来自原WindowsLook颜色合同。星号字体沿已有原独立mask字体投影，实际Webadvance6，provider7不被当作OS常量。Caret纹理和时钟消费者不改。

## 精度边界

非零EmotionFont的generic路径与源font0分开，旧省略前缀的浏览器证据保留，但不再用于证明实际默认字体门禁。完整XML loader/virtual hook、任意后续EmotionFont赋值未执行；原OS字体/字宽、逐值scroll和GPU/framebuffer保持父缺口。
