# 建房 frame 正式页面验收（UI-07-R-FRAME）

PASS。`node --import tsx tests/browser-room-create-visual.mjs --frame-only`通过正式大厅入口采集800×600、1080p、4K页面，等待React实际比例提交后核对33个源控件及四组frame的真实矩形。

三分辨率将每个frame片的屏幕矩形除实际scale，与`room-create-frame-native.json`的26个原Image::draw目的位置/尺寸逐一对照，同时核对绘制顺序、中心Image内框及所有按钮中心命中。每一页普通点击原关闭按钮后，dialog与frame节点卸载；再次普通打开进入下一分辨率。未重跑无改动建房业务或其他模式。

证据为`browser-room-create-frame.json`、`browser-room-create-frame-{800x600,1080p,4k}-open.png`。原完整函数及provider范围见`room-create-frame-source.md`。这些是源frame目的矩形到真实React的几何对照；不是原GPU截图对照，中心格式化、图像自动缩放和像素采样仍未证明完整一致。

专属3270服务、5300 Vite、9500 Chromium及临时目录全部清理，证据processCleanup均true。

当前正式HD验收入口使用新`room-create-scale-native.json`的imageset整数尺寸期望；本页旧PASS保留native图尺寸consumer合同，当前高清行为见`room-create-scale-browser.md`。
