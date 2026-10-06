# 建房密码字符源消费（UI-07-R-PASSWORD）

原 Editbox 的默认 MaskCodepoint 是 `U+002A`（星号）。建房初始化显式开启密码输入 masked；WindowsLook 的实际文字 draw 与光标/选区宽度消费者接收星号串。

`recovery/evidence/ui/room-create-password-native.py` 执行原指令，`recovery/output/room-create-password-native.json` 为 PASS，含中文、选中、长密码、失焦四向量；原指令保存在同名 `.disasm.txt`。执行从完整 `WLEditbox::drawSelf` `0x1000a420` 入口到 `0x1000aede`，背景与矩形、String、Font extent/draw 和 Image draw 为明确提供者。

Base 构造 `0x100580b9..0x100580cf` 默认 masked=false、MaskCodepoint=0x2A，setter `0x10054c90` 开启 masked。CDTank.exe `0x4a25c6` 查找 `CreateRoomDlg/edtPassword` 存到对象+0x4c，`0x4a2623..0x4a2628` 调用 setTextMasked(true)。此原建房初始化还写原长度8/20；正式Web由INPUT-LIMIT消费原8/20码点规则，见room-create-input-limit-source/browser.md。

WindowsLook `0x1000a6b3..0x1000a6e2` 读 masked `+0x329`、码点 `+0x32c` 与 String 码点数 `+0x44`，向空 String 插入同数量星号。`0x1000a6f5` 取光标前缀传 Font extent；选区分割和光标/选区背景的宽度同样使用 masked String。原 draw 入参不含密码明文。

## 正式 Web 字体投影

`recovery/export_ui_password_font.py` 由标准 `assets:ui` / `assets:fonts` 从现源 `ui/fonts/SIMSUN.ttf` 生成独立 `SIMSUN-password.ttf`，不修改原字体。子集将 U+002A、Chromium密码码点 U+2022 及其他常用掩码码点映射到源 asterisk outline、内嵌点阵字形与相同 hmtx advance。`recovery/evidence/ui/room-create-password-font.py` 调用正式导出器独立验证，`room-create-password-font.json` 核对每个映射的完整轮廓及宽度；源 advance512/unitsPerEm1024。

同一个正式 `type=password` 使用独立字体，普通房名继续继承源 SIMSUN。输入值、原生选区、光标、横滚、IME、焦点和提交保持现有状态持有者；字体只投影掩码字形。没有第二个密码表单或明文展示节点。

## 精度边界

完整原 selected 路径在源EmotionFont0下绘完整前缀、选区和后缀星号。7字密码选区1..4实际为1颗前缀、3颗选区及3颗后缀。原0x1000a9b1零指针门禁跳至0x1000aef6普通前缀draw；非零EmotionFont另行扫描2501..251E。资格、完整draw及正式消费者见room-create-password-selection-source.md和room-create-name-emotion-gate-native.json。

正式选区星号层按源EmotionFont0显示完整星号串与独立背景位置，当前验收沿NAME-EMOTION-GATE共享页面闭环，见 `room-create-password-selection-source.md` 与 `room-create-password-selection-browser.md`。原 caret/selection extent 向量使用提供的每glyph7/line16，不证明原字体OS字宽、精确选区矩形、原光标纹理、GPU或framebuffer。正常 masked 星号字符与选区文字/背景已分别闭环验收，原CaratImage与闪烁状态消费者已另接 `room-create-caret-source.md`，整体PASSWORD及原整页高精度仍保留原scroll offset逐值等价、字体OS与GPU/display边界。
