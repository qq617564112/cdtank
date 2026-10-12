# 等待页原地图名有限字形缺口

正式`txtMapName`的26个mode/map记录、14个唯一 MapName 仍缺四个原采样字符：早、约、翰、房。正文450glyph库已覆盖其它地图名字；补齐后有限集合454 glyph。原 MINGLIU.TTC face0 cmap支持四字，仍需实际原FT采样与正式页面验证。

生产来源为`MAPS.name`→`RoomSnapshot.roomInfo.mapName`→`waitingRoomInfo.mapName`→正式 SourceStaticText `txtMapName`。一字缺失使该控件整串落入TTF fallback：mode1/map4早安一路、mode1/map11约翰的路、mode4/map7木桶广场新手房分别覆盖四字。数据清单`waiting-room-map-name-glyph-inventory.json`逐模式/地图记录当前缺字。

M5-03-R-MAPNAME-GLYPHS限定在既有原字体采样输入集加入全部正式 MapName 字符，三DPI96/103/192恢复四字共12原bitmap/advance/ink；全26地图名缺字0与既有450库保持。正式三个普通建房/读取/Leave案例三res逐glyph/完整mapName/title/水平extent与clip截图，未知用户姓名/房名仍fallback；不扩全22k字库。

等待页其余有界普通源文字为房号、人数、时间数字及本人标记“你”，已在450库；玩法/友伤/队伍/按钮中文是既有原PNG资源。玩家姓名和房名可由用户输入，保留未知fallback，不以固定字符表假称它们全部已知。状态条/错误文案属于已有Web语义文字，不纳入原地图名切片。

有限四字原采样与正式页面验收见`waiting-room-map-name-glyphs-source.md`及`waiting-room-map-name-glyphs-browser.md`。
