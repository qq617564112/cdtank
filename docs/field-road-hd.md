# 田野路（高清）

地图 ID 为 `1002`，原版田野路为 `2`。高清地图继承原版的五种模式配置、出生点、导航、碰撞、城堡和场景物件位置。房间地图选择器与雷达使用独立的高清俯视图。

贴图按照已确认的绘画风格，通过 `gpt-image-2-medium` 参考原图重绘。源图集的坐标、排列和透明遮罩在拆分时保留。连续地形贴图先对齐原图的道路、石块和叶片轮廓，再保留原图的底色及边缘过渡，叠加高清细节。19 个 GLB 模型只替换嵌入的 PNG 数据，几何、UV、顶点颜色、动画、材质和采样配置保留。城堡各状态及物件破坏后的贴图同样使用高清资源。原地图资源仍按原路径加载。

## 资源与调用预算

共 85 张运行时贴图。三种木围栏共用同一份绘画结果；`lu01` 复用已确认的 2048×2048 样图。其余贴图按照固定网格拼图，一次调用生成整张图，再按网格坐标拆分。

| 类别 | 批次数 | 每张贴图尺寸 |
| --- | ---: | --- |
| 路面 | 6 | 1024×1024；`lu01`、`lu15` 为 2048×2048 |
| 植物、地形、屋顶、木桶、围栏等 | 3 | 1024×1024 |
| 天空、房屋和城堡图集 | 5 | 1920×1920；`obj05448A` 为 2048×2048 |
| 32 帧水纹 | 2 | 256×256 |

最终素材分为 16 组，生成时最多 4 个请求并发。本轮共提交 20 次请求，其中 3 次超时；按 23 次上限计数，还保留 3 次预算。每次提交在 `art/field-road-hd/calls.json` 中记录；失败请求也计入预算，生成器不自动重试。固定批次、拼图输入及完整提示词保存在 `art/field-road-hd/batch-plan.json` 和 `art/field-road-hd/batches/`。API 密钥通过环境变量 `IMAGE_API_KEY` 或终端隐藏输入读取。

`art/field-road-hd/png/` 保存拆分后的贴图；`inventory.json` 记录对应的原路径、高清路径和实际输出尺寸。`overview.png` 为全部资产预览，`comparison.png` 为原图与高清图对照，`map-preview.png` 为使用原模型和高清贴图离线绘制的地图俯视图，`terrain-preview.png` 为道路端头及相邻草地的放大图，`water-preview.gif` 展示 32 帧水纹。

## 安装

原游戏资源安装完毕后，运行：

```sh
npm run assets:field-road-hd
```

该命令直接使用仓库中的 PNG，复制场景、战场、移动数据及相关资源，生成独立的高清 GLB，并登记音乐与地图选择器预览，不调用图片 API。`assets:install` 先从原资源生成移动数据，再导出测试地图与高清地图；`assets:custom-maps` 也包含高清地图导出。

维护工具 `scripts/generate-field-road-hd.py` 提供 `prepare`、`generate`、`extract` 和 `overview` 四个操作，需要 Pillow、numpy 与 opencv-python-headless。`scripts/render-field-road-hd.py` 需要 Pillow 与 numpy，可以通过 `--texture-root` 指定贴图目录、通过 `--output` 指定预览路径。PNG 是本版的美术交付格式。
