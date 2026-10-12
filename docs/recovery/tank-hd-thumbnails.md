# 坦克高清缩略图

全部 21 种原客户端坦克使用实际三维模型渲染为 1024×1024 图标。商城、仓库、等待房间、玩家资料、交易和结算坦克奖励通过 `sourceUiImage` 统一解析 `set:tanke0` 图片引用。右下角的 `L`、`M`、`H` 和 `S` 使用独立 HTML 文字叠加。

图片位于 `apps/web/src/assets/tanks/thumbnails/`，通过静态 PNG 导入随前端发布。紫色背景和黑色边框包含在图片内，文字由 `TankIconMark` 和 `source-tank-icon.css` 绘制。

## 批量生成

安装项目依赖并准备 `apps/web/public/`、`apps/server/resources/tables/tankshop.json` 后，在仓库根目录执行：

```sh
node scripts/render-tank-thumbnails.mjs
```

脚本自行启动独立 Vite viewer 和无头 Chromium，不需要游戏服务器或账户。浏览器优先读取 `CDTANK_CHROME`，否则查找 Playwright 缓存和 Linux 常见 Chromium 路径；资源目录可用 `CDTANK_WEB_ASSETS` 指定。结束后关闭本次启动的浏览器和 Vite，并删除临时目录。

每次读取 `tanks.json` 中的全部坦克并更新 PNG 与 `thumbnails/index.ts`。总览输出为 `recovery/output/tank-thumbnails-overview.png`。

单独渲染一台坦克：

```sh
node scripts/render-tank-thumbnails.mjs --tank 53
```

共用相机角度和与原图对应的贴图配置位于 `scripts/tank-thumbnail-viewer/icons.json`。

## 渲染规则

- 使用现有 `TankView.loadPreview` 装配原始模型、材质和卡通描边。
- 按原图涂装选择对应的炮塔、车身和履带贴图，其余沿用 `tankshop` 默认配置或模型默认贴图。
- 固定静止动作首帧、35° 方位角、20° 俯视角，全部模型共用正交相机角度。
- 在透明背景上完整渲染模型，再裁掉背景留白。等比缩放，使轮廓最长边占图标的 87.5%，并将轮廓包围框置于图标正中，保留完整炮管和履带。
- 先以 2048×2048 渲染，再裁切并平滑缩放至 1024×1024，合成原版紫色背景 RGB(189,138,189) 和黑色边框。
- 文字映射位于 `apps/web/src/assets/tanks/icon-marks.ts`，通过 HTML `span` 叠加在右下角，按图标尺寸缩放。`L`、`M`、`H` 和 `S` 均使用正体、透明背景、黄色粗体和黑色描边。
- 界面沿用原控件尺寸和选择状态。

渲染结果逐张查看；未运行测试、页面验收、构建或类型检查。
