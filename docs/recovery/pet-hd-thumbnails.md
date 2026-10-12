# 宠物高清头像

全部 10 种宠物使用实际三维模型渲染为 1024×1024 PNG。等待房间、仓库、商城和交易等界面的 `set:gy0 image:data\ui\gy\maogou_<ID>.tga` 引用通过 `sourceUiImage` 统一替换为高清头像。

图片位于 `apps/web/src/assets/pets/thumbnails/`，通过静态 PNG 导入随前端发布。蓝色底和黑色边框已包含在图片内。

## 渲染

准备项目依赖和 `apps/web/public/` 后，在仓库根目录执行：

```sh
node scripts/render-pet-thumbnails.mjs
```

单独调整一张头像时，修改 `scripts/pet-thumbnail-viewer/portraits.json` 中对应宠物的参数，然后执行：

```sh
node scripts/render-pet-thumbnails.mjs --pet 104
```

可用 `node scripts/render-pet-thumbnails.mjs --pet 104 --views` 输出四个完整模型参考视角到 `tmp/pet-portrait-views/104/`，供逐张查看角度。

脚本从 `apps/shared/content/definitions/index.json` 读取宠物清单和名称，通过 `PetView.load` 加载各宠物定义指定的模型。独立 Vite viewer 和无头 Chromium 只用于离线渲染，结束后关闭本次进程并清理临时目录。

浏览器优先读取 `CDTANK_CHROME`，否则查找 Playwright 缓存和 Linux 常见 Chromium 路径。资源目录可用 `CDTANK_WEB_ASSETS` 指定。批量命令更新全部头像与 `thumbnails/index.ts`，总览输出为 `recovery/output/pet-thumbnails-overview.png`；单张命令只更新指定头像。

## 渲染规则

- 沿用现有宠物模型、材质、贴图和卡通描边，固定静止动作首帧。
- 使用正交相机，逐张对照原版选择方位角、俯仰角、取景中心和大小，头部占满头像框，保留口鼻与下巴。
- `portraits.json` 的 `target` 是完整模型包围盒内的 XYZ 比例，`span` 是相机取景边长与模型高度的比例。方位角 0° 为朝右侧面，90° 为正面，俯仰角为正时向下看。
- 先渲染 2048×2048，再平滑缩小至 1024×1024，合成原版蓝色背景和黑色边框。边框与坦克图标一致，为纯黑直角框，厚度占图片边长的 1/32（1024×1024 图片为 32 像素），绘制在图片内侧。
- 界面按现有控件尺寸等比例显示，不改变列表布局和选择行为。
