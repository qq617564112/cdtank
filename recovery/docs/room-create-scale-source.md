# 建房原imageset整数缩放消费／高清适配（UI-07-R-SCALE）

原完整链执行通过：`room-create-scale-native.py`执行CEGUIBase.dll的Imageset::notifyScreenResolution0x10018de0、updateImageScalingFactors0x10018d40、真实map迭代器0x1000d470、Image横纵缩放0x10018640/0x100186e0、frame setter0x100ad840及RenderableFrame绘制0x1001e6b0。证据`room-create-scale-native.json`提供四panel×三sourceViewport及四fullWindowProvider向量。

notify将输入display宽高除imageset NativeHorzRes/NativeVertRes，写+0xac/+0xb0；AutoScaled+0xa8为true时，update从map header+0x9c遍历真实节点，Image为node+0xa4，逐个执行两缩放函数。整数宽高及offset写Image+0x20/+0x24/+0x28/+0x2c。执行fixture构造原节点及真实迭代链，源图区域尺寸和offset由源imageset供给，未替换遍历或round计算。

正式Web采用既有居中800×600 sourceViewport乘min(windowWidth/800,windowHeight/600)作为imageset display输入。原gy0/mycabin00均AutoScaled=true、Native800×600，三标准视口factor为1、1.8、3.6。renderer先按原float32乘法整数round原图尺寸，再除舞台scale设局部frame宽高，最终屏幕图尺寸保持整数。四edge inset、corner跨度及中心内框均消费该整数图尺寸，控件外框仍保留源XML的统一舞台投影。

例如daditu Left47在1080p取85屏幕像素，角图46取83；4K分别169与166。Top/Bottom以两个角图整数宽限定跨度；center以实际边图整数宽限定内框。源frame独立消费与不同边宽差异均保持。

## 边界

display输入是明确Web sourceViewport适配。原函数接受full-window1920×1080时factor为2.4/1.8，另有fullWindowProvider向量证明；它不是正式页面选择的输入。原System究竟收到整window还是letterbox display、原RelativeRect/AbsoluteRect宽屏布局生产未恢复，不能将此适配称完整原HD界面。

源图offset在本页为0；原非零offset缩放函数已执行零offset向量，未扩大到其他图集。本片截获Image::draw参数，没有执行原GPU采样、字体、颜色或父alpha。旧frame/image证据保留，代表native图尺寸或显式float provider下的消费者；高清原imageset整数消费以本片sourceViewport向量为准。
