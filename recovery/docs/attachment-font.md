# 界面动态字体

应用动态文字使用用户提供的香蕉宽毛刷灵感体，CSS family 为 `CDTank-Xiangjiao`，字体资源为 `/ui/fonts/xiangjiao-brush.ttf`。普通文字、输入框、对话框、计数、聊天和战斗 HUD 文字使用同一字体。战斗中的伤害、治疗和暴击数字继续由原数字图片绘制；静态贴图中的文字和表情图片保持原资源。

动态字体控件保留原布局边界及水平、垂直对齐，使用正常文本替代字库贴图。多行说明按附件字体实际宽度换行；建房输入光标和密码选区使用输入框当前字体测量。Home 昵称只有一个可见文本层。

## 验证

`recovery/output/attachment-font-accepted.json` 收录 20 张完整页面截图、字体载入与计算样式检查，以及中文输入光标测量。大厅、玩家信息、道具/宠物/坦克商店和设置页覆盖 800×600、1920×1080、3840×2160；地图选择和建房覆盖 1920×1080。建房中文光标索引 2 的位置为 20px，与附件字体测量一致。

完整 Web 类型检查和统一生产构建通过，工程日志为 `recovery/output/attachment-font-plant-bounds-playerinfo-production-web-build.log`。宠物技能详情、熟练度以及宠物/坦克模型自动旋转与鼠标查看沿用 `browser-five-page-feedback-2026-10-05T01-46-22-012Z.json` 的实际交互证据。

## 未完成范围

WAITING/PLAYING 字体运行尾段未完成，记录在 `attachment-font-room-tail-incomplete.json`。坦克六项目录参数显示见 `shop-tank-buy-parameters.md` 的原购买页绑定与实际验证。Home 统计刷新是独立 Web 控件，原刷新按钮皮肤未确认。这些范围未计作恢复完成。

坦克原购买页参数来源及验证索引为 `shop-tank-buy-parameters-accepted.json`。
