# 建房输入文字源消费（UI-07-R-INPUT）

原 `WindowsLook/Editbox` 在绘制文字时用 Window effective alpha 覆盖颜色 alpha。`edtRoomName` 与 `edtPassword` 的 `NormalTextColour=00FFFFFF` 因而进入白色 RGB；源默认 Window alpha 1 对应普通白字。WindowsLook 默认选中文字也是白色，活动选区 RGB 为 `607FFF`，非活动选区为 `808080`。

`recovery/evidence/ui/room-create-input-native.py` 执行原 DLL 指令，结果 `recovery/output/room-create-input-native.json` 为 PASS。原指令保存在同名 `.disasm.txt`。

| 原入口 | 已证消费者 |
| --- | --- |
| CEGUIBase `0x10058820` | NormalTextColour 属性 setter 调用 stringToColour，再调用 Editbox::setNormalTextColour |
| `0x1001caa0` / `0x10001ab0` | 十六进制值进入原 colour 构造，00FFFFFF 存为 ARGB 浮点 `[0,1,1,1]` |
| `0x100556e0` | 普通文字色存入 Editbox `+0x3e8` |
| WindowsLook `0x1003a400/410/430/450` | 原静态初始化产生普通/选中/活动与非活动选区色 |
| `0x1000b4a9..0x1000b5c2` | WLEditbox 构造字段复制，选中文字 `+0x400`、活动选区 `+0x418`、非活动 `+0x430` |
| `0x1000a979` / `0x1000ac0a` | 普通与选中文字消费者经原 ColourRect::setColours、setAlpha，到 Font::drawText 入参；alpha 1 与 0.5 四组向量通过 |
| CEGUIBase `0x10030e50` | 无显式 Font 时取 System `+0x20` 默认 Font；显式 Font 则直接返回 |
| `0x10030e60` | Window effective alpha 两向量实际执行 |

源 `WLEditbox::drawSelf` 的完整保留指令没有按 disabled 改文字色的分支。普通与选中文字共用 effective alpha；选区底色按输入焦点及 readonly 选择活动/非活动色。正式 Web 禁用输入保持普通文字色和 opacity 1，原输入属性的 RGB 经局部 helper 投影，字体从现正式页面继承。

## 精度边界

String 的 C-string 与 CRT sscanf 为提供者；原属性 setter、colour 构造、颜色字段与最终文字 draw 颜色入参执行原代码。绘制切片的文本、矩形、布局局部量及 effective alpha 局部量为明确提供者；effective alpha 的原 getter 另行执行。没有执行整段 Editbox 字形排版、选区矩形、密码字形或 GPU。

无 Font 的回退规则已证明，但原 System 默认 Font 的运行时配置、字体 OS 解析、点到像素、字宽与最终 framebuffer 尚未证明。正式页面沿已有 CDTank-SIMSUN 源字体资源、12px/16px 和页面 scale；浏览器光标、密码圆点、焦点轮廓属于现 Web 呈现。完整原高精度页面父项保持未完成。
