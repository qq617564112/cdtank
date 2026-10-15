# 高清贴图

高清源图覆盖战车、宠物、饰品、地图物件、场景模型、特效、涂鸦小地图及保留图片的界面元素。模型几何、UV、动画和碰撞来源沿用原资源。当前 UI 使用手绘卡通控件、图片艺术字与原来源 glyph，动态正文使用附件字体。

## 战车与履带

21 辆战车保留 323 套有效主题皮肤，车身与炮塔共 518 张高清源图，长边 4096；没有独立炮塔的车型只使用车身图集。履带包含 74 张补充动画图集、81 条颜色记录，按移动方向推进，停车保留相位。覆盖数量、六视角预览和帧规则见[战车素材](tank-hd.md)。

4K 是创作源图尺寸，发布战车贴图按压缩配方缩至长边 1600。原图、高清源图和运行成品分别保存。

## 地图物件

地图物件高清化包括放置物、建筑、墙体、树木、围栏、装饰、破坏物及碎块、城堡动作，以及地图模型中的静态建筑组。完整原图与模型 UV 共同决定重绘范围；透明轮廓和原图宽高比例保留。道路、地面、水面与天空不属于该物件重绘范围，它们使用各自的既有素材和配方。

对象与贴图对应关系记录在 [inventory.json](../tools/map-api/inventory.json)，来源、模型分组、六视角预览和发布工具见[地图物件工具](../tools/map-api/README.md)。本地模型对照材料位于 `output/imagegen/map-api4k/`，发布对照位于 public 的 `map-audit/`。这些预览记录素材范围；完整游戏表现另按任务清单验收。

物件高清源图长边 4096；运行尺寸按实际模型 UV 密度计算，建筑、树木及地面类长边上限 2048。未选中的地面、水面与天空材质保留各自来源。

## 发布与画质选择

素材按运行资源相对路径存入 `art/hd/`，原版导出保存在 `art/original/`。从源图经 [recipe.json](../scripts/asset_compression/recipe.json) 一次缩放与编码到 `art/compressed/` 与 `art/compressed-mobile/`，再发布 UI 图集和怀旧／HD 战斗资源；其它独立贴图、JSON 和模型按对应路径同步。

```bash
npm run assets:compressed
npm run assets:compressed-mobile
npm run assets:sprites
npm run assets:battle-artwork
```

手机、平板和电脑通过 `battle-artwork.json` 选择怀旧或 HD。怀旧恢复原尺寸贴图，电脑 HD 使用 compressed，移动端 HD 使用 compressed-mobile，逐张尺寸与怀旧版一致；UI 使用既有素材，移动端小地图使用 512×512 底图，商城等预览保持 HD 美术并在移动端读取缩小成品。操作见[显示设置](display-settings.md)，尺寸与编码见[资产压缩](asset-compression.md)，目录及原素材重建入口见[运行美术资源](original-assets.md)。

## 限制

战车和地图物件的模型对照沿用各批素材记录，后续压缩、双画质切换与场景光照尚无完整游戏内视觉和性能验收。既有两图实测的范围见[浏览器性能](browser-performance.md)。
