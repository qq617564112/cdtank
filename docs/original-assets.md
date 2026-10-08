# 运行美术资源

运行界面、按钮整图、静态文字、数字、表情、人物肖像、加载背景、标志与光标使用原始客户端资产。动态正文使用附件字体 `XiangJiaoKuanMaoShuaLingGanTi-2.ttf`；数字字体沿用原图片 glyph。

3D 模型材质保留现有贴图，包括战车、宠物、地图、场景物件、模型特效、可选皮肤和材质动画帧。小地图底图使用 `cartoon-minimaps` 中的涂鸦手绘资源，保留当前小地图标记。

## 来源与安装

`art/hd-assets/inventory.json` 的 `original` 字段指向原始 PNG，`recovery/output/verified/assets/data` 保存解包后的客户端资源。UI 区域由原始 imageset 的坐标直接裁切，DDS 按源坐标方向转换。3D 保留范围由实际 GLB 材质、内容定义及场景材质目录解析。

```sh
npm run assets:original
```

该命令恢复非模型原图、字体和本地标志，保留附件字体，重新导出 UI 与表情目录，清理无引用图片，并重新发布精灵图及其映射。屏幕键盘保持移除。原图和高清交付保留在美术目录。

`npm run assets:hd` 仅安装模型高清贴图，并执行同一套原图发布流程。`npm run assets:rebuild -- --reuse-verified` 在导出资源后安装模型高清贴图、原版 UI 和仓库中的附件字体。

运行图片位于被 Git 忽略的 `recovery/output/web-assets`；源码提交与资源包分别保存。当前恢复前的运行资源快照位于 `backups/pre-original-assets-20261008/web-assets`。恢复统计与模型贴图保留路径位于 `art/hd-assets/original-runtime.json`。
