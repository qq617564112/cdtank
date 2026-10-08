# 战斗小地图彩铅手绘

战斗 minimap 使用儿童彩铅涂鸦画风，画风和细节密度以以下沙漠、田野路两张样图为准。

![沙漠](../art/minimap-cartoon/references/0001.png)
![田野路](../art/minimap-cartoon/references/0002.png)

## 画风与布局

- 明亮温暖的颜色，深灰铅笔轮廓，线条略微抖动、粗细不均。
- 地面、树冠、屋顶和水面保留可见的彩铅往返短线、排线、交叉笔触与少量漏涂留白。
- 保留较丰富的石块、砖缝、木纹、树叶、草花和水纹，细节密度与两张样图一致。
- 每张完整原地图是唯一布局依据。道路、河流、平台、障碍、基地和空白区域的位置、数量、尺度、朝向、连通关系及覆盖范围保持一致。
- 正上方俯视，保持完整画布。地图整体送入图片接口。

## 图片与提示词

资产目录：`art/minimap-cartoon/`。

| 路径 | 内容 |
| --- | --- |
| `references/style-reference.png` | 用户提供的彩铅插画参考 |
| `references/0001.png`、`references/0002.png` | 确认的沙漠、田野路样图 |
| `originals/<地图ID>.png` | 完整原地图 |
| `prompts/0001.txt`、`prompts/0002.txt` | 两张样图实际使用的完整 prompt |
| `prompts/style.txt` | 全量重绘的共用 prompt |
| `prompts/<地图ID>.txt` | 共用 prompt 加该地图的地形说明 |
| `responses/<地图ID>.json` | 图片接口返回结果 |
| `images/<地图ID>.png` | 完整手绘地图原文件 |
| `preview.jpg` | 全量地图预览 |

批量输入顺序固定：第一张为待重绘原地图，第二张为用户彩铅插画参考，第三、第四张为确认的沙漠、田野路样图。后面三张只用于画风与细节密度，布局以第一张为准。

共用 prompt：

```text
请把第一张图的地图重绘成第二张参考图那样的儿童彩铅涂鸦卡通手绘风，第二张仅是画风参考，不能把其中的人物、书、闹钟、糖果或汽车搬进地图。必须模仿参考图的真实手绘质感：深灰铅笔轮廓，略微抖动、粗细不均的线条；色块内部有清晰可见的彩铅往返短线、排线、交叉笔触和少量不均匀留白，像儿童认真用彩铅涂满的小插画，不是纯色矢量图，也不是水彩或3D渲染。颜色明亮温暖，造型圆润可爱。保留适量装饰和材质细节，细节密度与第三、第四张已确认地图一致：树冠有简单叶丛和铅笔涂色痕迹，石墙有少量不规则砖缝，建筑有屋顶板条和木纹，道路有疏朗的鹅卵石，草地有稀疏小草或小花，湖水有几条涂鸦波纹。不能变成只有几块平涂的大色块，也不要密集噪点、照片纹理或复杂光照。第一张地图是唯一布局依据，保持正上方俯视视角和完整正方形构图，主要地形、道路连通关系、建筑、桥、树群和基地的数量、位置、尺度与朝向均须对应原图。第二张的棋盘格只是背景展示，不要把棋盘格画入结果；结果仅为完整地图，不含风格参考拼图，不新增文字、标题、图例、画框或地图物件。
第三张和第四张是已确认的地图画风与细节密度参考，只参考彩铅笔触、轮廓、配色与材质表达，不能复制其地图布局或物件。直接重绘完整第一张原地图，保留丰富的原有地形细节。所有道路、河流、平台、空白区域和主要物件的边界必须对齐第一张，不能移动、合并、删除、简化或重排；不旋转、不镜像、不裁切，保持原画布比例与覆盖范围。
```

## 图片接口

使用 `curl --max-time 1300`，接口为 `http://192.168.10.140:13999/v1/images/edits`，模型为 `gpt-image-2.5-sunburst`，一次生成一张，结果读取 `data[0].url`。

```bash
export CHATGPT2API_KEY='你的原密钥'

curl --max-time 1300 \
  'http://192.168.10.140:13999/v1/images/edits' \
  -H "Authorization: Bearer $CHATGPT2API_KEY" \
  -F 'model=gpt-image-2.5-sunburst' \
  -F 'image=@art/minimap-cartoon/originals/0003.png' \
  -F 'image=@art/minimap-cartoon/references/style-reference.png' \
  -F 'image=@art/minimap-cartoon/references/0001.png' \
  -F 'image=@art/minimap-cartoon/references/0002.png' \
  -F 'prompt=<art/minimap-cartoon/prompts/0003.txt' \
  -F 'n=1' \
  -F 'response_format=url'
```

`scripts/cartoon-minimaps.py` 调用同一 curl 请求，密钥由环境变量读取，认证头通过标准输入传给 curl。请求失败后等待 300 秒再重试；已保存的图片直接复用，已有 URL 响应仅继续下载。

## 批量处理与安装

覆盖地图 `0001`—`0025`、`1001`、`1002`，共 27 张。

```bash
python3 scripts/cartoon-minimaps.py prepare
python3 scripts/cartoon-minimaps.py generate --workers 2
python3 scripts/cartoon-minimaps.py install
```

脚本依赖 Python、Pillow 和 curl。准备步骤读取 `art/hd-assets/sprite-originals/apps/web/src/assets/maps/minimaps/` 的完整原图及确认样图目录 `output/minimap-cartoon-samples/colored-pencil-v1/`。已有 `art/minimap-cartoon/` 输入时，可直接执行生成或安装。

安装将每张地图转为 1024×1024、质量 92 的 WebP，写入运行资源目录 `cartoon-minimaps/`。运行资源根目录默认是 `recovery/output/web-assets/`，可通过 `CDTANK_WEB_ASSETS` 指定。完整 PNG 保存在资产目录。

发布包保留 27 张彩铅版小地图。安装同时移除旧画风小地图的精灵索引、图集格子和独立发布文件；只包含旧小地图的图集整张删除，共用图集中的其它图片逐像素保留。

旧画风的 27 张完整备份保存在发布目录之外的 `art/hd-assets/sprite-originals/apps/web/src/assets/maps/minimaps/`，本批次输入副本位于 `art/minimap-cartoon/originals/`。单独清理发布包可执行：

```bash
python3 scripts/cartoon-minimaps.py clean-old
```

`apps/web/src/assets/maps/minimaps/index.ts` 映射到 `/cartoon-minimaps/<地图ID>.webp`。战斗载入时由 `BattleMinimapRenderer.setMap` 读取该图片；原有世界坐标范围、雷达旋转和坦克标记继续使用现有逻辑。
