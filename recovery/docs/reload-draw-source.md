# 原装填条绘制

`game_main.xml` 的 `prgCrossbar` 原矩形为373,234,50,37，Vertical，窗口Alpha0.6。BackgroundImage为原 `zhunxing.tga`（77/47），ProgressImage为 `zhunxing_yellow.tga`（77/48），两图均50×37。三个进度颜色均为 `80FFFFFF`，低中高段选择不产生RGB差异，黄色来自原进度纹理。

实际原 `WLProgressBar::drawSelf`（`0x1001bff0..0x1001c50c`）使用原float32进度，沿底部向上裁剪，物理extent为正数 `trunc(height * progress + .5)`；图片使用原AutoScaled图片尺寸取整并平铺。ColorRect的 `setAlpha` 把所选颜色alpha替换为窗口有效alpha，此条父窗口布局没有额外alpha，最终为float32(0.6)。颜色属性中的128/255不再额外乘一次。

背景ColourRect来自原静态Colour对象 `0x10077084`。原DLL静态初始化 `0x1003ac20` 以 `00FFFFFF` 调用 `Colour(uint)`；背景RGB为白，随后Alpha同样被有效窗口alpha替换。native执行原静态初始化至返回并核实际入参，Colour(uint)的float结果由provider供给。

`recovery/evidence/hud/reload-draw-native.py` 完整执行drawSelf至返回，记录三种比例缩放（1/1.8/3.6）和九个进度的27向量。证据 `recovery/output/reload-draw-native.json` 包括背景/前景目标矩形、裁剪和四角RGBA，所有fill RGB为白，alpha为float32(0.6)。原LIFE-DRAW三阈值/ProgressBar默认色与tile合同继续复用。

正式 `SourceProgress` 统一消费源控件图片、RGB乘法、平铺尺寸、像素extent和父窗口alpha。HealthControl仍按权威HP/maxHp提供float32比例；ReloadControl仍独立 `useSyncExternalStore` 订阅reload进度，不把连续装填更新推至整个HUD。

原装填时长入口、25帧数学及完成清零证据复用 `reload-hud-native.json` 与 `reload-hud-source-sol.md`：total=f32(duration+.5)，每帧扣除remaining，进度为f32((total-remaining)/total)。服务器射击期限不增加0.5秒；首快照根据serverTime补elapsed为已登记重建同步。

## 限制

native窗口矩形/有效alpha、图片尺寸、原静态初始化调用的Colour构造器输出、CEGUI辅助及最后Image draw由provider供给，没有Windows GPU/framebuffer。原完成观察者生产入口和完整UI frame dispatcher仍未执行；本片保留当前业务visible和生命周期规则，未证明原phase gate。
