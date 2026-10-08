# 普通 UI 文字与数字

普通文字采用浏览器轮廓字体绘制。216 个原图片区域包含 72 个普通标签及六组数字、字母与符号，兼容原 PNG / DDS imageset 引用。字体映射覆盖 226 个原图片路径。原来的六张数字图集及四张普通点阵图集已移出发布目录，原图片保留在 `art/hd-assets/original`。

聊天支持 `<image set=... name=.../>` 按名称引用图片，144 个普通字图仍通过精灵图提供给这种图片标签。普通控件继续使用字体渲染。独立字图文件已移出发布目录。

`apps/web/src/interface/resources/source-text-artwork.json` 保存文字、字色、描边、原始占位、墨迹边界和数字 advance。普通标签通过 `SourceStaticImage` 绘制，选中标签通过 `SourceButton` 绘制；状态徽标、房间编号、道具数量、战斗计时、团队存量和结算数字使用同一组样式。

文字采用 Noto Sans SC Bold，拉丁单位采用 Arimo Bold，数字采用 Archivo Black。三个本地 WOFF 子集共 33,808 字节。字体文件位于 `recovery/output/web-assets/ui/fonts/source-*-bold.woff`，源字体及 OFL 许可位于 `art/hd-assets/font-sources`。字体子集使用独立的 CDTank 名称。

数字保留每个字形的原宽度和透明留白。蓝色、青色、黄色及白色原字色、黑色或浅色轮廓分别设置；房间编号保留黄色阴影。`∞`、`×`、百分号、冒号、`km/h` 和 `°/sec` 使用真实字符。等级标签按原图拆为独立文字段，保留动态数值所在的空白。

字体渲染使用实际 DOM 文字，支持现有战斗 Canvas 文字绘制层。普通标签随控件尺寸缩放，数字随现有页面比例缩放。原艺术字和复合美术继续使用现有图片。

重新导出：

```sh
recovery/.venv/bin/python scripts/export-ui-text-rendering.py
recovery/.venv/bin/python scripts/preview-ui-text-rendering.py
```

`art/hd-assets/font-rendering-preview.html` 包含 144 个独立原图区域与字体文字的离线对照，可切换 1×、2×、4×。`art/hd-assets/previews/font-rendering-comparison.png` 为代表性样式对照。

资源核对结果在 `art/hd-assets/font-rendering-inspection.json`：原图片区域映射完整、使用字符均存在于对应字体中、占位尺寸与原图一致。

## 验证范围

已完成原资源目录、字体字符映射、占位尺寸及离线图片核对。按照仓库协作要求，未运行测试、构建、类型检查或浏览器验收。轮廓字体匹配原图的颜色、轮廓和占位，字形并非原点阵的逐像素复刻。
