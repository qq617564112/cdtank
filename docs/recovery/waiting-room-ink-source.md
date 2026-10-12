# 原等待静态字形位置与阅读（M5-03-R-INK）

正式`SourceStaticText`按原SIMSUN mono glyph的inkX/inkY、baseline、advance和Image宽度绘制，保留完整textContent读取。每个glyph以真实Image宽高裁atlas区域，不再以advance宽度裁字形；水平extent为max(逐glyph ink右边界、总advance)，HorzCentred/RightAligned按该extent定位。源文字区域仍overflow hidden。

原`Font::getTextExtent 0x10011130`的Image width+offset与累计advance/max已在WRAP执行；`Font::drawTextLine 0x10011440`读取Image offset+0x20/+0x24、目的rect和glyph advance进行draw，其指令与实际mono atlas取证保存。原字体由CEGUI内嵌FreeType2.1.10执行MINGLIU.TTC face0、Size9、flags0x1004生成；不使用host FreeType。

本片进一步实际执行原`0x10010b1f..0x10010b76`以face ascender/unitsPerEm×y_ppem写Font baseline，以及face height/unitsPerEm×y_ppem写lineSpacing。96 DPI为9.609375/14.390625，103为10.41015625/15.58984375，192为19.21875/28.78125；真实非整数结果进入`ui-font-raster.json`。正式StaticText将其除stage scale投影到原逻辑区域，再沿已有StaticText垂直居中/上下对齐与裁剪消费。

已知整串使用透明文字语义层和aria-hidden图形层，保证textContent、中文复制与可读语义保留；未知整串继续原TTF fallback。原atlas为透明RGBA白glyph；现正式454有限glyph覆盖全部地图正文，见`waiting-room-description-glyphs-source.md`。stage scale capped2、DPI切片最近选择仍为Web适配。MultiLine的Canvas extent/advance及16行距provider未由本片替换，完整Windows framebuffer/GPU和全字库仍是父缺口。

地图说明的正常绘制现由`waiting-room-description-draw-source.md`独立闭合：已知 glyph 使用原采样/度量与真实行距，未知字形仍为 TTF/Canvas provider；该后续片不扩大本片有限静态字形范围。
