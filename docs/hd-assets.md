# 高清贴图

高清版只保留模型贴图与 minimap。UI 图标、按钮、肖像、静态文字、数字、表情、加载背景、标志与光标使用原版低清图片。

高清贴图位于 `art/hd/`，按运行路径保存。`manifest.json` 记录模型贴图与原始模型的对应关系；田野路 `1002` 的贴图及预览位于 `art/hd/custom-maps/1002/`。

`npm run assets:hd` 读取原始模型，安装高清材质图片并保留几何、UV 和动画，再发布原版 UI 与高清 minimap 的独立图片。原始资产保存在 `art/original/`。

目录与发布方式见 [运行美术资源](original-assets.md)。
