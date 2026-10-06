# 建房源遮罩验收（UI-07-R-MASK）

PASS。`node --import tsx tests/browser-room-create-visual.mjs --mask-only`在正式大厅入口运行，独立3270服务、5300 Vite、9500 Chromium；未注入游戏状态或重跑建房业务。来源与边界见`room-create-visual-source.md`。

800×600、1200×600、1080p、4K等待实际React缩放提交后验证源遮罩(0,-1)、800×599尺寸及居中基准区投影，源PNG30×30解码和alpha153、transparent native backdrop、pointer-events:none与所有按钮中心真实hit。800×600→1200×600保持scale1但遮罩left由0更新到200，证实宽屏同倍率resize使用实际viewport尺寸。每个分辨率使用原关闭按钮，dialog及mask节点卸载，截图背景恢复；再次普通打开继续下一分辨率。证据为`browser-room-create-mask.json`及四组open/closed真实页面截图。

`tests/room-create-mask-pixels.py`使用每个分辨率暴露底图上的一个真实截图像素，比较关闭页RGB与源PNG RGBA的alpha合成。实际open RGB为(26,56,89)，闭合底图为(64,92,112)，源重采样RGBA为(0,31,73,153)，四个点最大通道误差均1/255。证据为`room-create-mask-pixels.json`。这验证当前Chromium中原PNG的透明表现，不能代替完整原CEGUI父alpha或原GPU framebuffer对照。

四组截图、源几何及关闭清理通过；专属服务、浏览器和临时目录全部清理，3270/5300/9500无残留监听。完整UI-07-R像素1:1仍保持未完成，字体继承、frame消费、原运行截图等缺口不由此遮罩切片关闭。
