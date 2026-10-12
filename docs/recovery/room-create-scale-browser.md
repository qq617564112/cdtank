# 建房高清frame正式验收（UI-07-R-SCALE）

PASS。`tests/browser-room-create-visual.mjs --scale-only`通过正式大厅入口，独立3270服务、5300 Vite、9500 Chromium。800×600、1080p、4K等待实际舞台scale提交后对四panel的26个frame片以及中心内框逐一比较，期望取原imageset真实整数缩放后的frame draw输出。

实际屏幕目的位置/尺寸与对应sourceViewport原向量比较；source控件外框继续保留源矩形，所有按钮中心真实hit。每个分辨率普通点击原关闭按钮卸载dialog及frame，再从普通入口打开下一分辨率。PNG来自既有源裁块，不重跑未改变的建房业务、账户或其他模式。

证据为`browser-room-create-scale.json`及同前缀三标准分辨率open截图。原完整链及输入provider范围见`room-create-scale-source.md`。该片是正式Web高清适配的原imageset整数消费验证，不能证明原System宽屏display生产或原GPU像素一致。

6项实际验收检查通过；3270/5300/9500进程及临时目录已清理，processCleanup均true。
