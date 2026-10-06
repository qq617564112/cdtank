# 正式地图说明全文原字形验收

`browser-waiting-room-description-glyphs-2026-10-03T23-03-27-005Z.json`为 M5-03-R-DESC-GLYPHS PASS27。原有限采样与全部正式表覆盖见`waiting-room-description-glyphs-source.md`及`waiting-room-description-glyphs-source.json`，每套450 glyph、全部26正文缺字0。

正式普通map7建房→原等待页读取→普通Close/Leave→mode5/map21重建，在800×600、1920×1080、3840×2160均取得实际截图，全文与最新权威RoomSnapshot.mapDescription一致。等待当前viewport、stage scale、DPI face和逐字atlas提交后，对照每个原glyph的advance/inkX/inkY/baseline/尺寸/atlas、每行原lineSpacing位置、文档高度和源文字clip；六个正式页面fallback均为0。

| 正式正文 | 分辨率 | scale | DPI | 已知原字形 | fallback |
| --- | --- | ---: | ---: | ---: | ---: |
| map7 | 800×600 | 1.0741687979539642 | 103 | 66 | 0 |
| map7 | 1080p | 2 | 192 | 66 | 0 |
| map7 | 4K | 2 | 192 | 66 | 0 |
| map21 | 800×600 | 1.0741687979539642 | 103 | 78 | 0 |
| map21 | 1080p | 2 | 192 | 78 | 0 |
| map21 | 4K | 2 | 192 | 78 | 0 |

普通房名输入`地图说明🙂验收`经服务器确认并附原模式/地图后缀，三个分辨率完整标题均与权威roomInfo.name一致；未知字符使静态整串保留可读TTF fallback。独立长说明props含🙂及有限集合之外字符，每次208个原字形/128个fallback，三res wheel、原箭头一步、End、透明thumb拖动、变文held capture释放/归零及关闭卸载通过。长props不冒充原地图正文。

选定截图同前缀`-800x600-ordinary-description.png`、`-1080p-ordinary-description.png`、`-4k-ordinary-description.png`及三res`-longest-map.png`；还有长props顶部/拖动图。实际观察800map21、4Kmap7原点阵正文，原192字形尺寸完整保留；高于行距的ink沿原区域clip而没有改小采样bitmap，独立fresh face对照见来源文档。

原失败运行23-02-15完整保留；最终普通标题检查对照完整权威标题和模式/地图后缀。全专属process/临时目录清理true，3283/5313/9513无监听。root统一Web type/build1m30与311正式模块边界PASS，日志`breach20-05462-glyphs-final-web-build.log`及`breach20-05462-glyphs-final-boundaries.log`。

命令：`node --import tsx tests/browser-waiting-room-description-glyphs.mjs`。本片没有网络/场景/业务改动，原账户/CPU/双端基线沿用。

## 限制

完成范围为全部当前正式地图正文392字符加现静态集合450 glyph。未知用户输入仍fallback；原CRT providers、Web有限DPI/stage cap2、Chromium投影、原Windows framebuffer/GPU/display整页精度保持既有父边界，不宣称完整字体或原整页像素1:1。
