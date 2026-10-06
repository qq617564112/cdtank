# 等待页地图说明阅读与原垂直滚动消费者（M5-03-R-DESC）

正式等待页`edtMapDesc`使用原183×102区域、FFFFFFFF文字、SIMSUN默认字体，以及原WindowsLook垂直滚动栏布局、箭头PNG和透明滑块。普通阅读支持键盘、滚轮、箭头和透明滑块拖动；说明变化及卸载释放捕获并重置阅读位置。

`recovery/evidence/ui/waiting-room-description-native.py`执行原CEGUIBase/WL代码，`waiting-room-description-native.json`为PASS：26个消费向量（2布局、2文字区域、4configure、3wheel、9thumb、6fitting）和2个构造默认值。正式接线是`waiting-room.tsx`→`SourceMultilineReading`，旧说明span/padding3/DOM滚动栏已由源阅读区域替换。

## 原区域与滚动栏

`room_main.xml`的`edtMapDesc`为WindowsLook/MultiLineEditbox，父kuang，AbsoluteRect为12,18→195,120。外框、背景、caret、selection和thumb图片均为空，NormalTextColour为FFFFFFFF；没有显式Font，沿已执行的System默认SIMSUN/Window::getFont链读取。默认字体证据见`waiting-room-visual-source.md`。

WL `getTextRenderArea 0x1001a430`原执行得到零边缘inset；无纵栏时宽183，有纵栏时宽173.85，page高102。`layoutComponentWidgets 0x1001a750`原相对纵栏位置(.95,0)、大小(.05,1)，得到9.15宽。浮点目的矩形保留源float32边界，Web CSS序列化允许其正常小数精度。

MultiLine `configureScrollbars 0x10087170`读取本对象的12字节行向量和Font lineSpacing，document为行数×lineSpacing，page取实际文字区域，step为max(1,lineSpacing)。1/6行不显示纵栏，7/32行显示；本交付字体投影lineSpacing为16。`onMouseWheel 0x100869b0`执行原−step×wheelChange并沿原Scrollbar范围夹紧。

其工厂使用WLVertScrollbar；原thumb算术已执行：减箭头高为track起点，track=max(0,height−2×减箭头高)，thumb=max(10,track×page/document)，位置按剩余track与滚动范围线性分配。构造默认minimumThumb为10实际像素，未使用聊天控件的40。1、420/391、2倍下九个top/mid/end向量包含原Image float32乘法/圆整。正式逻辑空间使用minimum10/scale以及圆整后的26/27高箭头。

上箭头Normal/Hover/Pushed分别为`ui/regions/60/144.png`、143、142（28×26）；下箭头分别为136、137、138（28×27）。透明thumb保留真实命中与拖动，纵栏裁剪原28宽按钮到9.15栏内可见部分。上下边界仍允许普通按钮操作，由原范围夹紧。

## 文字拟合与阅读投影

原`Font::getCharAtPixel 0x1000e5a0`执行六个前缀拟合向量，宽度刚好等于累计advance时包含该字符。默认wordWrap=true已执行。正式`source-multiline-layout.ts`已接原wordWrap格式化行结构，extent与advance分别供给，见`waiting-room-wrap-source.md`；先183宽排版，溢出后以173.85宽重新排版，整行在原区域裁剪。

Web键盘Home/End、上下/Page上下、Tab/Enter箭头和指针捕获是阅读操作适配。DOM滚轮按deltaMode分别消费16行单位、102页单位或pixel/scale；此DOM单位桥接与原wheelChange步骤证据分别记录。

## 精度边界

原wordWrap `formatText 0x1008fe70`的完整原入口、Font extent/fitting及行结构已实际执行并接入正式组件，见`waiting-room-wrap-source.md`。Font行距/字形度量、String/行向量存储、窗口通知/setter与最终字形绘制仍为明确provider；当前12px/16px、Canvas字形度量是Web投影，编辑、caret或selection未交付。源FFFFFFFF属性和原默认Font已核对，未将本片声明为完整MultiLine normal draw、原Windows字宽/光栅或GPU/display一致。父级其它排版模式、字形与整页像素缺口保持。
