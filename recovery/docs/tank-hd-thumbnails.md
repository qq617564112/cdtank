# 坦克高清缩略图

全部 21 种原客户端坦克使用实际三维模型重新渲染的透明缩略图，输出为 512×512 PNG。商城、仓库、等待房间、玩家资料、交易和结算坦克奖励通过 `sourceUiImage` 统一解析 `set:tanke0` 图片引用。

图片位于 `apps/web/src/assets/tanks/thumbnails/`，通过 `new URL(..., import.meta.url)` 随前端发布；资源安装和重建不会覆盖这些图片。原始 imageset 和提取资源保留。

## 批量生成

安装项目依赖并准备 `recovery/output/web-assets/`、`recovery/output/verified/tables/tankshop.json` 后，在仓库根目录执行：

```sh
node scripts/render-tank-thumbnails.mjs
```

脚本自行启动独立 Vite viewer 和无头 Chromium，不需要游戏服务器或账户。浏览器优先读取 `CDTANK_CHROME`，否则查找 Playwright 缓存和 Linux 常见 Chromium 路径；资源目录可用 `CDTANK_WEB_ASSETS` 指定。结束后关闭本次启动的浏览器和 Vite，并删除临时目录。

每次读取 `tanks.json` 中的全部坦克并更新 PNG 与 `thumbnails/index.ts`。总览输出为 `recovery/output/tank-thumbnails-overview.png`。

## 渲染规则

- 使用现有 `TankView.loadPreview` 装配原始模型、材质和卡通描边。
- `tankshop` 有记录时使用原默认炮塔、车身和履带贴图；其它坦克使用模型内嵌贴图。
- 固定静止动作首帧、45° 俯视角和前侧三分之四视角，炮口朝向画面前方，使用正交相机。
- 按投影后的模型顶点居中取景，保留边缘留白，完整显示炮管和履带。
- 先渲染 1024×1024，再平滑缩小到 512×512，背景透明。
- 坦克图片按原控件尺寸等比例居中显示；统一图片入口在透明高清图下叠加原32×32图标的紫色底、1像素黑框及对应类别角标，保留界面选中状态。底色取原tanke0图集的RGB(189,138,189)，角标从轻型、中型、重型及两组等级图标原区域提取，资源位于`apps/web/src/assets/tanks/icon-frames/`。高清缩略图重建保持透明，背景与角标由界面独立合成。

已执行全部 21 种坦克的批量渲染并检查总览及代表图片；本次未运行测试、构建或类型检查。
