# SIMSUN原字体点阵消费者（M5-03-R-FONT）

`SIMSUN.font`实际定义为`MINGLIU.TTC`、face0、Size9、NativeHorzRes800、NativeVertRes600、AutoScaled=true、AntiAlias=false。原GameBoxRenderer `getHorzScreenDPI/getVertScreenDPI 0x100011a0`均直接返回96。Font constructor `0x10011680`经`FT_New_Memory_Face`、`FT_Set_Char_Size`建立face，`createFontGlyphSet 0x100103f0`以AntiAlias false对应`FT_Load_Char 0x100cd900` flags0x1004加载glyph；`drawGlyphToBuffer 0x1000e660`消费MONO bitmap转目标像素。

`recovery/evidence/ui/waiting-room-font-native.py`实际执行CEGUI内嵌FreeType 2.1.10与原MINGLIU.TTC，使用原CRT内存/String调用provider，导出96/103/192 DPI三套透明RGBA mono atlas与454个有限字符（全部正式地图说明/地图名与原静态72字符的并集）。输出`waiting-room-font-native.json`及`web-assets/ui/fonts/SIMSUN-mono-{dpi}.png`为PASS；每套记录advance、inkX/inkY、width/height和atlas总宽高。96 DPI中文12×12、advance12、ASCII advance6、pixelMode1，原baseline/lineSpacing已由INK实际消费取代，见`waiting-room-ink-source.md`；face metrics unitsPerEm1024、ascender820、descender−204、height1228。

`source-font-raster.ts`提供最小正式加载接口：`loadSourceFontRaster`读取证据目录，`sourceFontFace`按Web stage scale选择96/103/192原DPI切片。Atlas的像素是原FT mono bitmap；Web/CSS缩放只是将native目标DPI切片投影回逻辑控件坐标。未知字形继续沿现有SIMSUN Web fallback，不把有限切片声明为整套22K字形或原Windows framebuffer。

原AutoScale调用点`notifyScreenResolution 0x10012190`以viewport/native尺寸更新scale，`updateFontScaling 0x10011910`重新按FT字号与DPI生成字形；当前等待页stage scale capped2是Web布局适配，不能声明1920/4K原renderer窗口同尺寸。完整FreeType外部OS、原GPU/display与整页截图仍为父边界。

`node --import tsx tests/source-font-raster.mjs` PASS检查三套PNG的灰度mono类型、atlas宽高、中文/ASCII advance及原baseline/lineSpacing元数据；PNG atlas为白色glyph+透明alpha，避免glyph span出现黑底；这项检查不启动网络或游戏状态，也不把浏览器fallback字形当原点阵。

## 正式等待页验收

`browser-waiting-room-wrap-2026-10-03T22-27-26-183Z.json`为字体接线后的正式页面PASS25，覆盖800×600、1920×1080、3840×2160。每个分辨率均观察到7个已知SIMSUN atlas glyph、4个未知字fallback节点和已加载`CDTank-SIMSUN` face；同一运行继续核对源地图行序、长说明滚动、变文、卸载和临时目录/浏览器清理。汇总索引为`browser-waiting-room-font-index-2026-10-03T22-27-26-183Z.json`。

SourceStaticText已按stage scale选择96/103/192 atlas：glyph span宽度按1/scale投影，atlas背景透明，baseline/lineSpacing实际原算术现由INK消费，见`waiting-room-ink-source.md`。该页验收证明静态文字已知字的原mono采样接线及未知fallback行为；MultiLine仍使用独立extent/advance度量provider，未声明其Canvas字形为原Windows像素。

地图说明的正常绘制现由`waiting-room-description-draw-source.md`独立闭合：已知 glyph 使用原采样/度量与真实行距，未知字形仍为 TTF/Canvas provider；该后续片不扩大本片有限静态字形范围。

全部正式地图正文的有限字形覆盖与当前资源验收见`waiting-room-description-glyphs-source.md`；原72库与其历史页面证据保留独立快照，正式当前atlas为454glyph。
