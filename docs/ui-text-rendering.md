# UI 文字与数字

静态标签、数字、字母、艺术字和状态徽标使用高清 PNG。图片 glyph 保留 `ui-fonts.json` 的原占位尺寸和字符映射；普通输入与动态正文继续使用界面字体。

带文字按钮使用各自原状态的完整图片作为 API 输入，高清重绘时去除文字，保留原轮廓、配色、插画、白色描边、阴影与透明留白。运行时使用无字 PNG 底图，并按原墨迹坐标叠加字体文字。

`apps/web/src/assets/button-artwork.json` 保存按钮背景路径和文字位置、颜色、描边及阴影。`SourceTextArtwork` 只消费这份按钮清单。每种交互状态使用自己的 PNG。

按钮字体文件位于 `recovery/output/web-assets/ui/fonts/source-*-bold.woff`，源字体及 OFL 许可位于 `art/hd-assets/font-sources`。

```sh
python3 scripts/export-ui-text-rendering.py
python3 scripts/prepare-raster-button-backgrounds.py
python3 scripts/redraw-hd-ui.py --jobs art/hd-ui-redraw/raster-button-jobs.json --workers 10
python3 scripts/install-redrawn-ui.py --jobs art/hd-ui-redraw/raster-button-jobs.json --candidate-dir art/hd-ui-redraw/raster-button-candidates
```

候选图逐张目视核对后安装无字背景，再执行 `scripts/prepare-button-artwork.py` 更新按钮清单。原图和原高清交付保留在美术目录；发布目录仅保存运行引用的图片。
