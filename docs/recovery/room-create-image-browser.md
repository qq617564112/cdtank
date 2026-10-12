# 建房中心图正式验收（UI-07-R-IMAGE）

PASS。`node --import tsx tests/browser-room-create-visual.mjs --image-only`通过正式大厅入口，在独立3270服务、5300 Vite、9500 Chromium采集800×600、1080p、4K实际页面。每次等待React缩放提交后核对33个源控件及四panel中心图目的位置/尺寸，与原消费者12向量逐一比较。

四panel中心原PNG实际解码，CSS为100%×100%、源offset0、HorzStretched/VertStretched与inner-rectangle clip。源图均全不透明；四panel的实际位置/尺寸误差小于0.1屏幕像素。所有按钮中心真实命中；每个页面普通Escape关闭后dialog和中心图节点卸载，再从普通入口打开下一分辨率。

证据为`browser-room-create-image.json`及同前缀800×600/1080p/4K-open截图；原consumer及provider边界见`room-create-image-source.md`。正常开关、命中及卸载通过，未重复建房业务、账户或五模式。专属服务、浏览器和临时目录全部清理，processCleanup均true。

本片比较原图片资源与目的/clip几何及真实正式截图，不宣称原GPU逐像素采样一致。imageset factor生产/全链遍历、原运行截图、字体/父alpha仍为父任务缺口。

当前`--image-only`正式HD测量委托整数imageset期望，旧中心consumer证据保持原输入provider合同；当前中心内框随rounded frame变化，见`room-create-scale-browser.md`。
