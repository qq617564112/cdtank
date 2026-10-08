# 宠物高清头像

全部 10 种宠物使用实际三维模型渲染为 512×512 透明 PNG。仓库、商城和交易等界面的 `set:gy0 image:data\ui\gy\maogou_<ID>.tga` 引用通过 `sourceUiImage` 统一替换为高清头像。

图片位于 `apps/web/src/assets/pets/thumbnails/`，通过 `new URL(..., import.meta.url)` 随前端发布。头像保持透明，蓝色底和黑色边框由 CSS 绘制。

## 批量生成

准备项目依赖和 `recovery/output/web-assets/` 后，在仓库根目录执行：

```sh
node scripts/render-pet-thumbnails.mjs
```

脚本从 `apps/shared/content/definitions/index.json` 读取宠物清单和名称，通过 `PetView.load` 加载各宠物定义指定的模型。独立 Vite viewer 和无头 Chromium 只用于离线渲染，结束后关闭本次进程并清理临时目录。

浏览器优先读取 `CDTANK_CHROME`，否则查找 Playwright 缓存和 Linux 常见 Chromium 路径。资源目录可用 `CDTANK_WEB_ASSETS` 指定。生成脚本更新全部头像与 `thumbnails/index.ts`，总览输出为 `recovery/output/pet-thumbnails-overview.png`。

## 渲染规则

- 沿用现有宠物模型、材质、贴图和卡通描边，固定静止动作首帧。
- 正面偏侧 45°、俯视 30°，使用正交相机。
- 按模型前半部、底部以上 40% 的顶点取景，突出头部和上半身，保留脸部与耳朵。
- 先渲染 1024×1024，再平滑缩小至 512×512，保留透明背景。
- 界面按现有控件尺寸等比例显示，不改变列表布局和选择行为。
