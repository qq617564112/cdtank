# 原地图名有限字形补齐（M5-03-R-MAPNAME-GLYPHS）

正式原等待页的26个模式地图记录、14个唯一 MapName 已全部使用原 SIMSUN 字形，加入四字“早、约、翰、房”后有限库由450扩为454。来源为正式m001..m005.MapName→MAPS.name→RoomSnapshot.roomInfo.mapName→SourceStaticText.txtMapName；不扩大用户输入字符集合。

`waiting-room-font-native.py`把正式MapName与已采样正文/静态字符取并集，原 CEGUIBase 内嵌FreeType2.1.10、MINGLIU.TTC face0、Size9、flags0x1004、DPI96/103/192实际加载并采样。新增12个原MONO bitmap和advance/ink/尺寸进入同一正式atlas，全部26 MapName和26正文每套缺字0。96/103 atlas5454×12，192 atlas9613×39。

`tests/source-map-name-glyphs.py`核对新增集合精确为四字、每套MapName缺字0、新增pixelMode1/非空ink/正advance、实际PNG白RGB/二值alpha/尺寸；1350个旧450 glyph的metadata和RGBA裁片逐字与450快照完全一致。输出`waiting-room-map-name-glyphs-source.json`PASS。旧450库以`waiting-room-font-450-native/raster.json`及三套`waiting-room-font-450-{dpi}.png`保留；原72库也保持。

正式已有SourceStaticText按原known整串glyph的advance/ink/baseline/extent居中并裁原文字区域。MapName全部known无需新的JSX/CSS或度量投影；未知用户房名/昵称仍使用既有整串TTF fallback。玩法/队伍/按钮文字为既有原PNG，普通人数/房号/时间数字与本人标记“你”已覆盖。

命令：`recovery/.venv/bin/python recovery/evidence/ui/waiting-room-font-native.py`，`recovery/.venv/bin/python tests/source-map-name-glyphs.py`，`recovery/.venv/bin/python tests/source-description-glyphs.py`。

## 限制

454是正式正文/地图名与原静态有限集合，不是全部22k字库。原CRT为明确providers，Windows framebuffer/GPU/display整页精度仍为父缺口；Webstage cap2/最近DPI/Chromium图片投影沿用已明示适配。
