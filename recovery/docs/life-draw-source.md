# 原生命条绘制

原 `CEGUIWindowsLook.dll` 的 `WLProgressBar::drawSelf`（`0x1001bff0..0x1001c50c`）完整执行至返回，得到 108 个横向/纵向、1/1.8/3.6 倍缩放、九个比例、两种有效透明度的背景及填充 draw 向量。证据为 `recovery/output/life-draw-native.json`，执行器为 `recovery/evidence/hud/life-draw-native.py`。

EXE 的远端 `0x4ced39..0x4ced5f` 与本地 `0x4cee89..0x4ceeac` 将当前 HP 转为 float32，除以整数最大 HP，再交给实际执行的 `CEGUIBase::ProgressBar::setProgress`（`0x10096620`）钳制到 0..1。32 个向量覆盖最大 HP 300/777 与普通、零和超过上限的当前 HP。构造器尾段 `0x10096974..0x10096993` 证明三个默认颜色均为 `FFFFFFFF`。`0x4ced87..0x4cee77` 的 0.3 比较用于头像状态。

绘制在 float32 0.34 和 0.67 分界选择三个离散颜色。横条从左向右，竖条从下向上裁剪；正数物理裁剪长度为 `trunc(length * progress + .5)`。背景和进度图片使用原自动缩放后取整的图片尺寸平铺，进度颜色乘以原图片 RGB，保留原图片透明度。 背景Colour对象由原静态初始化 `0x1003ac20` 以 `00FFFFFF` 调用Colour(uint)，RGB为白；执行器执行该原初始化并用明确的Colour构造器provider供给[1,1,1,0]，实际draw再覆盖有效alpha。

`game_main.xml` 的 `prgLife` 原坐标为 311,563,179,28，低/中/高色为红/黄/绿，背景 77/20，进度 77/21。队伍布局竖条为 14×33，红队进度 77/105、蓝队进度 77/107，颜色使用原默认白。imageset 原 AutoScaled=true，原生尺寸 800×600。

正式 React 消费者使用 `life-progress.ts` 的原 float32 比例和整数物理 extent，按原布局颜色属性/default white 选择 sRGB RGB 乘法，原资源平铺与像素裁剪分别实现。权威 HP/maxHp 继续来自原已接战斗状态。

## 限制

native 提供窗口矩形、有效 alpha、自动缩放图片尺寸、CEGUI Rect/ColourRect 辅助与最后 Image draw 记录；没有 Windows GPU/framebuffer。编译器整数转换 provider 保留原向零截断。浏览器为该正式消费者的真实实绘验收，未证明跨 GPU 整屏等价。原 phase 到 HUD bool 来源保持独立未闭合。
