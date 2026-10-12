# 房卡猫狗图片原父裁剪（M5-02-C-IMAGECLIP）

正式 RoomCard 的 maomao、gougou 保留原图片目的矩形与拉伸采样，按原父 picModeNormal 的内区裁剪。sourceProps 的源父子绝对位置决定四边 CSS inset，裁剪不会缩小图片目的尺寸。其它图片继续保留其显式 ClippedByParent=False 的外延。

roomlist_icon.xml 的 picModeNormal 相对卡片为 (19,41)–(98,89)，FrameEnabled=False，内区为79×48。猫图相对父为 (-4,21)–(26,45)，狗图为 (-3,0)–(27,22)。两图没有覆盖 ClippedByParent；原 Base Window 构造 0x1003a0a5 的默认 true 来源沿 chat-scroll-source.md。当前正式DDS优先选择猫图ui/regions/67/30.png（30×24）、狗图ui/regions/67/32.png（31×22）；狗图目的宽仍为30。

room-card-image-clip-native.py 执行 Window::getPixelRect 0x10039ae0、父 getInnerRect 0x10030e90 和 Rect::getIntersection 0x1001deb0。两图分别在scale1/1.8/3下执行ClippedByParent True/False，共12向量PASS。true使用父inner交集，false使用renderer区域；结果包括猫图左裁4×scale、狗图左裁3×scale。源XML绝对outer/inner和renderer矩形是provider，窗口裁剪条件、父递归、交集执行原代码。

## 边界

本片只恢复两个原图片消费者的父裁剪。当前既有DDS优先、Web舞台比例与完整窗口锚点不变；原资源管理器选源及Windows GPU/framebuffer由未完成父项保持。真实屏幕采样证明源图保留区域和裁掉区域的Chromium表现，不宣称完整滤镜边缘或Windows GPU全图等价。
