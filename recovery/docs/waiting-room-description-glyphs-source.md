# 正式地图说明原字形补齐（M5-03-R-DESC-GLYPHS）

正式26个模式地图记录、14份唯一 MapInfo 正文的392个实际字符全部接入原 SIMSUN mono 字形。保留既有静态文字字符后，有限集合为450 glyph；原采样96/103/192 DPI共1350个 bitmap，全部正式正文每套缺字0。

`waiting-room-font-native.py`直接读取正式来源`verified/tables/m001..m005.json`的 MapInfo，与原静态72字符取并集后逐字调用 CEGUIBase 内嵌 FreeType2.1.10。face为原 MINGLIU.TTC face0，Size9，flags0x1004；实际原 FT_Init_FreeType/New_Memory_Face/Set_Char_Size/Load_Char 执行。每个字记录真实 advance、inkX/inkY、bitmap width/height/pitch/pixelMode与 atlas 坐标，不以 cmap 可用代替实际采样。

每个实际 MONO bitmap按原 pitch/位掩码展开，再逐字核对其 atlas alpha 裁片；atlas RGB为白、alpha仅0或255。96与103 atlas为5402×12，192为9522×39。metadata写入`waiting-room-font-native.json`及正式`web-assets/ui-font-raster.json`，atlas为现有`ui/fonts/SIMSUN-mono-{dpi}.png`路径，正式读取组件直接消费。

`tests/source-description-glyphs.py`再次读取实际PNG与metadata：三套各450 glyph、全部26正文缺字0、RGBA尺寸/二值透明/白RGB、space零ink且advance为正。216个既有静态 glyph 的度量与裁片像素逐一对照原72库保持不变；旧库保存为`waiting-room-font-72-raster.json`、`waiting-room-font-72-native.json`与三套`waiting-room-font-72-{dpi}.png`。该校验不使用digest。`waiting-room-description-glyphs-source.json`记录PASS。

原192 DPI部分实际ink高于Font行距，原尺寸完整保留，正文按行递增且仅最终源文字区域clip。独立三套新 FT library/face各加载一个 glyph 的当前入口对照`waiting-room-description-glyphs-fresh-face.json`为PASS：售17×39、赞29×37、中21×28，与扩展采样完全一致。它们的advance均24，ink分别4/−20、−3/−20、2/−20；atlas按真实最大高度39打包。

命令：`recovery/.venv/bin/python recovery/evidence/ui/waiting-room-font-native.py`，`recovery/.venv/bin/python tests/source-description-glyphs.py`，`node --import tsx tests/source-font-raster.mjs`。

## 限制

字符集合来自全部正式地图正文与原静态集，未知用户输入保留TTF/Canvas fallback；这不是全部22k字体的采样。原CRT内存/string函数为明确providers，原FreeType运算与bitmap是真实执行。Web有限DPI选择/stage cap2与Chromium图片缩放沿用既有适配；原Windows framebuffer/GPU/display整页精度仍属未完成父项。
