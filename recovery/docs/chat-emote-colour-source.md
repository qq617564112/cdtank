# 非白 emote 原颜色绘制参数

八个向量 PASS：原 XML 消费者将 emote 自身 RGBA 写入 item，原 RichEdit 绘制将同一颜色复制到四角，原 SequenceImage 和 ImageFrame 将颜色传到 Imageset 绘制调用。红色、绿色、128 通道、alpha=0 和缺 RGBA 均保留到此调用；父文本 `<colour>` 不向 emote 继承颜色。

运行：`recovery/.venv/bin/python recovery/evidence/chat/chat-emote-colour-source.py`。输入、原 item、四角颜色和原绘制矩形保存于 `recovery/output/chat-emote-colour-source.json`，原指令保存于同前缀 `.disasm.txt`。脚本复用 `chat-xml-source.py` 与 `chat-rich-layout-source.py` 的解析、布局、字符串和 colour 值 provider。

## 通道结果

item `+12` 及 colour 四角的存储顺序为 alpha、red、green、blue；输出额外提供 item `floatRGBA` 和 draw `cornersRGBA`。

| 向量 | item RGBA | draw 四角 |
| --- | --- | --- |
| red | 1,0,0,1 | 四角相同 |
| green | 0,1,0,1 | 四角相同 |
| midpoint | 0.501960814,0.501960814,0.501960814,0.501960814 | 四角相同 |
| transparent | 1,0,0,0 | 四角相同，仍提交 image draw |
| missingRGBA | 0,0,0,0 | 四角相同 |
| parentIsolation | 0,0,0,0 | 红色父节点不影响 emote |
| ownOverridesParent | 0,1,0,1 | 红色父节点内绿色 emote 保持自身颜色 |
| fixedLineSpacing | 026: 0.501960814,0,1,0.501960814；001: 0,1,0,1 | 各自四角相同 |

缺失通道由原消费者向 XMLAttributes 请求的默认值决定，结果全零。父 colour 中的 A/B 文本为 `0xffff0000`，闭合后的 C 为 `0xffffffff`；同位置的 emote 保留自身属性/default，构成父文本颜色与 emote 颜色隔离证据。

## 原执行路径与几何

每向量执行原 TinyXML 文档与 RichEdit XML 遍历、item 布局及绘制。原 RichEdit 在 `CEGUIWindowsLook.dll:0x10024859` 调用 SequenceImage；独立 Unicorn machine 使用原 CEGUIBase 指令，依次执行 `SequenceImage::draw 0x10027410`、`ImageFrame::draw 0x10018780`，捕获其调用 `Imageset::draw 0x10018a90` 的实参。两个 DLL 使用相同 preferred base，因此复制消费者内存到独立 machine。实际序列帧矩形与 duration 取原资源，elapsed=0 选择第一帧，帧 offset=0。

所有颜色的目的矩形保持 `[itemX+1,lineY,itemX+sourceWidth,lineY+sourceHeight]`，advance 使用完整源宽。001 源宽16、高14，目的宽15；026 源宽50、高14，目的宽49。fixedLineSpacing 的两图顶边分别为10、26；原字体 provider 行距16，颜色不改变行距或原裁边几何。Imageset 调用收到的目的矩形和四角颜色逐项等于 RichEdit 的 SequenceImage 调用实参。

断言检测颜色传递丢失、四角不一致、父文本颜色泄入 emote、alpha=0 被提前跳过、颜色改变目的矩形，以及固定行距变化；发生任何一项时应重新核对该调用边界或 Web 对应合同。

## 限制

Imageset::draw 入参之后的原纹理 provider 未供应：该函数需要 `Imageset+0xa4` 的 Texture 宽高虚调用和 Renderer `+0x18` 虚绘制。本证据在 `0x10018a90` 入口返回，未执行后续 clip/UV、Renderer 或 Windows GPU 像素。colour 数值与 ARGB 转换由已有显式 provider 供应；原消费者的属性读取、通道赋值、颜色复制和 draw 调用实际执行。ASCII7/中文14 advance 与行距16 是字体 provider 输入。Web sRGB 逐通道乘法是原四角颜色合同的浏览器 renderer 映射，不能由本结果声称 Windows GPU 像素完全一致。
