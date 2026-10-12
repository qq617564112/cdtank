# 等待页中央框与StaticText源消费者（M5-03-R-VISUAL）

正式等待页中央`zhongjianditu`使用原八个frame与中心PNG，房号、房名、地图名、人数、时间及名单使用原StaticText默认白色、源格式和文字区域裁剪。SheetWindow没有Image，FrameEnabled=False且frame为空；正式根保持透明，露出原地图。状态与错误仍在源visual外以Web状态条呈现。

`waiting-room-frame-native.py`执行原CEGUIBase的Image横纵缩放、Static frame setter/getUnclippedInnerRect、RenderableFrame与RenderableImage完整draw入口，输出`waiting-room-frame-native.json` PASS：8组启禁inner、32个frame draw、4个中心draw。原八框源厚度均16；边缘长度由相邻角图决定，中心使用四边图生成的inner inset。图片AutoScaled按当前Web页面scale消费原float32乘法与四舍五入，中心默认HorzStretched/VertStretched，图片offset为0。

资源层`source-static-image.tsx`收拢既有建房原frame消费者，两页共用；建房adapter保留源offset、context和selectors。等待页SourceImage仅StaticImage使用该消费者，StaticText另进专用文字消费者，缺战车图仍保留已有可见fallback。

## 原文字默认与draw

`waiting-room-static-text-native.py`执行原CDTank `0x454202..0x454236`：String构造接收`SIMSUN`（字节地址`0x5c69f0`），FontManager查询所得Font经原System::setDefaultFont写入`+0x20`。Window::getFont `0x10030e50`有显式Font返回`+0x40`，否则取System默认；没有读取父控件Font。

StaticText构造`0x100b1580`写默认水平0（LeftAligned）、垂直2（VertCentred），原colour/ColourRect构造产生四角ARGB`FFFFFFFF`。WLStaticText构造`0x10013720`仅替换vtable，没有覆盖这些默认。room_main的31个StaticText没有Font、TextColours属性；房号、房名、地图名、玩家名/称号显式HorzCentred，最低人数和时间RightAligned，最高人数保留默认LeftAligned。

原`StaticText::drawSelf 0x100b0db0`完整执行至`Font::drawText 0x10013030`边界，124个实际向量覆盖31控件、alpha1/0.5和源区域/缩小clip；原Rect交集限制文字draw，颜色alpha乘Window effective alpha，水平format作为原draw入参，垂直位置按原line count/line spacing及四舍五入计算。当前Web单行投影lineSpacing16，对15高房号得到top−1，13高人数/时间得到top−2，16高名单/名字得到top0。

正式`source-static-text.tsx`仅供本等待页的这些已核默认属性控件使用；加载原SIMSUN独立面后以12px/16px投影，按源HorzFormatting与VertFormatting位置、nowrap和区域overflow裁剪。普通长中文房名保持完整textContent、title与键盘focus读取。

## 精度边界

原窗口布局树、外部clip/矩形与Static背景是明确provider；String构造和FontManager名字查询供给实际源名/Font，System setter与Window getter执行原代码，原event回调由provider跳过。文字lineCount=1/lineSpacing16与最终Font字形排版为provider，12px/16px是Web字体投影，不证明原Windows字宽、光栅、抗锯齿或点到像素转换。Image draw止于绘制调用边界，图片PNG保留透明度，但原GPU/display未执行。

当前环境没有wine/wine64/Xvfb/xvfb-run，未取得完整原Windows等待页截图；本片证明原draw消费者、源资源/矩形与正式页面接线，不声明原整页1:1。MultiLineEditbox地图说明已接入原阅读区域和垂直滚动消费者，见`waiting-room-description-source.md`；原wordWrap formatText已原执行并接线，见`waiting-room-wrap-source.md`；其它排版模式、原OS字宽、称号数据、网络/回调及HD调用者仍保留父缺口。800×600页面scale与状态条属于明确Web适配，普通按钮在视口内可用，不把它当原HD布局。
