# 建房中心图原消费（UI-07-R-IMAGE）

原完整消费者执行通过。`recovery/evidence/ui/room-create-image-native.py`执行CEGUIBase.dll的`RenderableImage::drawImpl`0x1001f7e0、Image横向缩放0x10018640、纵向缩放0x100186e0。四个panel在倍率1、1.8、3.6共12组向量，以及3组收窄clip向量保存于`room-create-image-native.json`。

StaticImage构造0x100af75c–0x100af76b向+0x520/+0x524写3，默认HorzStretched/VertStretched；四个panel XML没有覆盖Horz/VertFormatting。RenderableImage在enum3分支将图片目的宽高设置为其内框宽高，并在原Image::draw边界传入与外部clip相交的内框矩形。源offset为0；源imageset四图没有XOffset/YOffset覆盖，当前图对象provider保留零offset。

源gy0与mycabin00 imageset均为NativeHorzRes800、NativeVertRes600、AutoScaled=true。原Image缩放函数对atlas宽/高及offset乘factor后按原float舍入到整数，写Image+0x20/+0x24/+0x28/+0x2c。例daditu46×46在factor1.8变83×83、3.6变166×166。当前正式中心是stretched，因此这些源图尺寸不改变目的内框；不能用该中心图结论代替frame的imageset最终全链缩放证明。

完整drawImpl使用四panel既有frame原执行inset供给内框。daditu native中心目的(47,46)/207×193；ditu2(15,15)/240×64；ditu3(15,15)/240×115；xiaoditu(51,0)/190×40。每个倍率的实际原消费者目的与clip按同一内框投影。额外clip向量以小于内框的外部clip确认相交，不改变目的尺寸。

正式React中心Image保留100%×100%原PNG背景、源offset0及明确stretched属性，在自己的内框矩形中clip；保持既有frame独立绘制。这个限定源消费确认了当前中心几何，并补正式显式clip接线，没有改变业务或字体。

## 边界

图对象atlas尺寸、offset、缩放factor、内外矩形与颜色对象由fixture提供。原Image scaling与RenderableImage formatting/clip计算执行，Image::draw0x10018780是截获边界，最终atlas纹理采样、原GPU及父alpha未执行。imageset遍历更新与factor生产未执行；factor使用既有800×600正式投影。原运行截图、字体继承和完整1:1不由本片关闭。
