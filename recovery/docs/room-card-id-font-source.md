# 房间编号原 MediumHT 字形（M5-02-C-IDTEXT）

RoomCards 的 txtRoomID 使用原 roomlist_icon.xml 显式 MediumHT 字体与 fangjianbianhao_0.imageset 的十张数字图片。编号字符串 R1–R17 的业务身份、完整文本、title、卡片 aria-label 均保留。原字体没有 R 图片；原 missing-ASCII 消费者对 R 不绘制、不增加 advance，所以可见编号为原数字图片。

原 txtRoomID 窗口相对 btnRoom 为 (−1,8)–(31,25)，32×17；HorzCentred，默认 VertCentred，四角颜色 FFFFFFFF。原图片有黄色 RGB(255,248,59)、黑边与 alpha，白色颜色乘数保留图片本色。数字1为7×14，其余为10×14，offset0。原 native1 extent/advance 为1→7，其余数字→10；baseline0，lineSpacing14。32×17窗口内行顶部按原 StaticText 居中规则为2，glyph按累计advance居中，窗口 overflow:hidden；字形层置源按钮图片之后且不截获 pointer events。

room-card-id-font-native.py 执行原 CEGUIBase.dll 的 Font::appendCharacter 0x10010d60、Font::getTextExtent 0x10011130、Font::drawTextLine 0x10011440，包含原 Rect 构造和 missing-ASCII 分支。十个实际 .font/.imageset 映射检验图像宽高与整数advance，R1、R10、R123、R9999、R、A1、123七向量检验原extent和绘制矩形。原 static image-bound metrics scan 0x1000de03–0x1000de94 得baseline0/lineSpacing14。glyph map lookup/insert、image对象、迭代器、CRT ftol和末端渲染为明确provider；字体入口与数值消费者执行原机器码。结果 room-card-id-font-native.json PASS，主agent独立 source review 为 room-card-id-font-root-source-review.json PASS。

SourceStaticText 保持原接口，只按 layout.control(name).properties.Font==='MediumHT' 分派独立 SourceBitmapStaticText。原 SIMSUN 函数体保持不变，拆名为 SimsunStaticText，hooks仍属于各自组件。新 source-bitmap-font.tsx 从现有 loadSourceUiFonts 取 MediumHT glyphs，绘制原图片并保留透明语义文本；room-cards.tsx 只将 txtRoomID 的 child helper 改为既有 text helper。CSS、字体目录、服务器、目录业务、SourceButton 均未改。

## 边界

此字体路径消费真实ASCII房间编号。原编号格式生产者仍未恢复，Web R前缀继续作为完整业务身份。800/1080p/4K显示采用已存在的 Web room-card stage projection，统一缩放 native1 的字形尺寸、advance与行高；原 Windows HD AutoScaled 的字体重计算与完整GPU framebuffer等价未证。原轮廓SIMSUN回退及全页window锚点仍沿既有消费。
