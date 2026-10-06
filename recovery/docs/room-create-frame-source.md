# 建房 frame 原消费（UI-07-R-FRAME）

原完整函数执行通过：`recovery/evidence/ui/room-create-frame-native.py`实际执行CEGUIBase.dll的`Static::setImageForFrameLocation`0x100ad840、`Static::getUnclippedInnerRect`0x100ad090及`RenderableFrame::drawImpl`0x1001e6b0。输出为`room-create-frame-native.json`，包含10组启用/禁用内框向量与四个源面板26次原Image::draw目的矩形。

setter调用真实`RenderableFrame::setImage`0x1001f440保存图指针。FrameLocation5为Left、6为Top、7为Right、8为Bottom；Left/Right取Image+0x20宽，Top/Bottom取Image+0x24高，分别写Static+0x494/+0x498/+0x49c/+0x4a0。无图指针写0。四个inset由对应边图生成，与角图尺寸无关。

getUnclippedInnerRect读取+0x328开关。启用时以四inset缩进外框，禁用时返回原外框。原Rect内存顺序为top,bottom,left,right；证据输出统一用left,top,right,bottom。外窗口矩形由显式provider供给，未执行窗口布局树生成。

原RenderableFrame绘制顺序为Top、Bottom、Left、Right、TopLeft、TopRight、BottomLeft、BottomRight。Top/Bottom横向目的区间由对应两个角图宽限定；Left/Right纵向目的区间由对应两个角图高限定。每一边自身厚度仍取该边图宽或高。四角保持源图自身宽高。

`daditu`源Left宽47、角图宽46：内框left47，Top/Bottom目的x46、width208，Left目的width47。正式renderer分别使用edge inset与corner span，保留这个源尺寸差异。`ditu2`/`ditu3`各边和角为15；`xiaoditu`只有Left/Right，均宽51、高度拉至40。FrameEnabled=False的tiao1/tiao2继续不画frame。

证据执行原frame矩形逻辑，到Image::draw调用边界截获目的区间。图对象的尺寸由源imageset供给，图offset为0，RenderableFrame的native目的矩形由控件XML供给；未替换frame计算。颜色对象为fixture零值，本片不证明颜色消费。Image::draw0x1000cbc0与0x10018780为最终图绘制provider边界，原Image autoscale、采样、GPU并未执行。

正式React按原目的矩形绘制frame，图片保留PNG透明度。中心Image按原getUnclippedInnerRect的inset限定区域，这证明中心内框几何，中心Horz/VertFormatting与clip另由`room-create-image-source.md`原执行确认，最终采样仍未执行。字体、原程序截图与完整alpha/GPU缺口继续保持，不关闭完整UI-07-R 1:1。
