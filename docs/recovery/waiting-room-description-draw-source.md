# 地图说明正常绘制消费者（M5-03-R-DESC-DRAW）

正式 React 地图说明按原 Font 行距生成阅读行、文档高度与滚动步长，已知字符以原 SIMSUN mono atlas 绘制。字形位置为累计 advance + inkX，纵向为 baseline + inkY；行位置为 index × lineSpacing − verticalScroll。未知字符继续使用原 TTF 的浏览器字形和 Canvas 度量，完整原正文只保留一次可读文本。

`waiting-room-description-draw-native.py`执行原 CEGUIBase `MultiLineEditbox::drawSelf 0x1008e1b0`及`renderText 0x10087650`完整正常只读分支至返回。WindowsLook vtable 的 drawSelf 跳转继承此入口。12 个向量、36 次实际 Font 调用覆盖三套实际 Font 行距、纵向 scroll 0/13.25、横向 scroll 2.5 和 effective alpha 1/.5。原 Rect offset/intersection、colour 与 ColourRect 构造均执行；Font drawText 是记录调用边界。

原 drawSelf 先把文字区域换为屏幕坐标并与窗口外部 clip 相交，再减去水平/纵向滚动；renderText 按行递增 Font `+0xbc` 行距，LeftAligned format0。原 renderText 将传入 clip.bottom 加5，保持文本 top 不变。正式正文独立阅读层高度为102+5/scale，并裁剪其内容；滚动页高与滚动控件仍为102。原 NormalTextColour FFFFFFFF 的 alpha 乘 effective alpha 后截断为 packed 字节，.5 产生127/255，随后传给 Font 的四角颜色；当前正式等待页有效 alpha1为白色。

`source-multiline-reading.tsx`按当前 SourceImageScale 选择已有原96/103/192 DPI face，使用其 advance/inkRight 度量已知字符，其余字符使用明确 Canvas provider；继续原 WRAP 的 extent/advance 分离格式化算法。文档/箭头步长/键盘及滚轮行单位使用真实 lineSpacing/scale，超过页高后按原纵栏宽重排。逐字 atlas 图片层为 aria-hidden；语义层保留整行原 textContent，未知字符可见层通过 CSS content 读取同一字符，避免重复可读文本。

## 限制

原 System renderer z、窗口文本区域/外部 clip、effective alpha getter、String substring/行向量存储为明确 providers。Font drawText 止于调用边界；已知点阵复用先前实际内嵌 FreeType2.1.10 与 MINGLIU.TTC face0 采样。72 个有限字符并非全部地图中文字库，未知 glyph 的字宽/ink/baseline 仍为浏览器 TTF/Canvas provider；tab 绘制仍是该 provider。Web stage cap2、三套最近 DPI 选择与普通键盘阅读属于既有适配。原编辑/选区/caret、全 Windows framebuffer/GPU、完整 display 与整页1:1保留父项。
