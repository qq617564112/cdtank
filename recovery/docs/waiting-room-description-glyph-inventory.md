# 正式地图说明有限字符集

正式26个模式地图记录的14份唯一正文使用392个唯一字符，原72个静态采样 glyph 集缺378个正文字符。保留已有静态字符后，目标共450 glyph。原`MINGLIU.TTC` face0 cmap覆盖全部392/392，正文没有 newline/tab/CR 等控制字符；有限补齐来源充分。

来源链为`apps/server/src/config.ts`的`MAPS`读取m001..m005表`MapInfo`，`rooms/snapshot.ts`直接写`roomInfo.mapDescription`。`waiting-room-description-glyph-inventory.json`保留全部字符、缺字符、每个mode/map及原 face0 cmap 支持结果。此统计使用正式支持数据，未扩展全部22k字库。

M5-03-R-DESC-GLYPHS限定扩展既有原内嵌FreeType2.1.10的有限采样输入集，保持face0、Size9、flags0x1004及三DPI96/103/192；正式 MultiLine 已可逐字消费新增元数据。可行性依据为同一原字体/同一已执行采样入口、原 cmap 全覆盖和450有限字符规模，实际 FT bitmap/advance 已执行验证，见`waiting-room-description-glyphs-source.md`。

验收全部26正式正文已知字形覆盖率100%、三个DPI原mono/advance/ink/透明atlas及真实map7/map21三res当前face全文known与普通读取/离房；未知用户输入仍可fallback。正式资源与页面验收见`waiting-room-description-glyphs-browser.md`。原Windows framebuffer/GPU/display保持父项。
