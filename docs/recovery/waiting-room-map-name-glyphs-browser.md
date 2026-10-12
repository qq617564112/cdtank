# 原地图名正式页面验收

`browser-waiting-room-map-name-glyphs-accepted.json`为 M5-03-R-MAPNAME-GLYPHS PASS24、9张实际PNG，覆盖mode1/map4早安一路、mode1/map11约翰的路、mode4/map7木桶广场新手房三个正式名称各800×600、1920×1080、3840×2160。有限新增四字及26名字覆盖见`waiting-room-map-name-glyphs-source.md`。

首段`23-15-22-609Z.json`完成mode1/map4全部8检查，包括三res与普通Leave；原整体FAIL完整保留，accepted只引用已完成索引0..7。续段`23-18-11-216Z.json`整体PASS16，以独立普通账户页完成mode1/map11与mode4/map7，各正常CreateRoom/三res读取/Close Leave。不同运行与账户不作为同账户连续建房证明。原`23-11-10`失败及保存DOM/网络诊断也保留。

每页创建后核对真实权威mode/mapName，再等待viewport、stage scale、实际原atlas glyph与DPI同时提交：800当前scale1.074168798/103 DPI，1080p与4K当前scale2/192 DPI。逐字检查原advance/inkX/inkY/baseline/width/height与atlas、原extent水平居中和源overflow clip，完整textContent/title均与roomInfo.mapName一致。普通点击地图名取得阅读焦点；未知🙂房名完整文本与权威roomInfo.name相符，仍为TTF fallback。

三case每次普通原Close/Leave清world与等待视图，续段随后dispose该独立context。两运行process/临时目录清理全true，3283/5313/9513无监听。800新手房和4K约翰实图已观察，root独立复核accepted/source并看两图。

代表图：`browser-waiting-room-map-name-glyphs-2026-10-03T23-18-11-216Z-4-7-800x600-map-name.png`、`browser-waiting-room-map-name-glyphs-2026-10-03T23-18-11-216Z-1-11-4k-map-name.png`；全部九图路径见accepted.screenshots。

统一Web type/build2m36与311模块边界PASS，日志`breach20-05442-mapname-final-web-build.log`、`breach20-05442-mapname-final-boundaries.log`。资源归属原font-native/atlas metadata，正式TSX/CSS、网络/场景/业务未修改；正文完整浏览器专项复用GLYPHS已完成范围。

命令：`node --import tsx tests/browser-waiting-room-map-name-glyphs.mjs`，本续段使用`--remaining`。

## 限制

完成范围为当前全部26原MapName的有限采样与正式静态绘制，454总glyph包含正文/静态集合；未知用户输入、原CRT providers、Webstage cap2/DPI适配、Chromium投影、完整Windows framebuffer/GPU/display父边界保持。整页1:1与完整页面状态仍由未完成父项验收。
