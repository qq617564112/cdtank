# 战斗小地图彩铅手绘

战斗 minimap 使用儿童彩铅涂鸦画风，画风和细节密度以沙漠、田野路两张图片为准。

![沙漠](../art/hd/cartoon-minimaps/0001.webp)
![田野路](../art/hd/cartoon-minimaps/0002.webp)

## 画风与布局

- 明亮温暖的颜色，深灰铅笔轮廓，线条略微抖动、粗细不均。
- 地面、树冠、屋顶和水面保留彩铅短线、排线与少量留白。
- 石块、砖缝、木纹、树叶、草花和水纹保留现有细节密度。
- 道路、河流、平台、障碍、基地和空白区域的位置、尺度、朝向、连通关系及覆盖范围沿用原图。
- 正上方俯视，保持完整画布。

## 资产与安装

27 张小地图底图位于 `art/hd/cartoon-minimaps/<地图ID>.webp`，原图位于 `art/original/local-images/assets/maps/minimaps/<地图ID>.png`。小地图标记保存在 `art/hd/local-images/assets/tanks/minimap-icons/`。

`npm run assets:original` 或 `npm run assets:hd` 将底图和标记作为独立文件发布到运行资源目录。`apps/web/src/assets/maps/minimaps/index.ts` 映射到 `/cartoon-minimaps/<地图ID>.webp`；战斗载入时由 `BattleMinimapRenderer.setMap` 读取。世界坐标范围、雷达旋转和坦克标记位置沿用现有逻辑。
