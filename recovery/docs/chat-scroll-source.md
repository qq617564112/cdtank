# 原战斗聊天历史滚动条

`game_main_chat_shrinked.xml` 的 `edtDisplayBox` 是286×94的 `WindowsLook/RichEditbox`。原垂直滚动条使用独立滚动位置，范围为 `0..max(0,document-page)`，显示条件为格式文本总高度大于可用文本区域高度或强制垂直模式。滚轮、箭头、thumb和文本变化共用这个位置。

运行 `recovery/.venv/bin/python recovery/evidence/chat/chat-scroll-source.py`：PASS。`recovery/output/chat-scroll-source.json`保留全部原VertScrollbar属性、精确源图片及PNG资源、必要逐指令证据和原执行向量。

## 几何与原资源

原 `WLRichEditbox::layoutComponentWidgets` 0x10022a70设置垂直条相对尺寸 `{0.05,1}`，相对位置 `{0.95,0}`，所以286×94控件对应条14.3×94，位于x271.7。XML空白RichEdit边框不占文本区域；垂直条出现时其宽度从可用文本宽度扣除。水平条出现时其高度也扣除。

原箭头普通图来自zhandou00：减按钮hdtan01.tga为28×26，增按钮hdtan02.tga为28×27。Base `Scrollbar::setDecButtonNormalImage` 0x1009ef20和`setIncButtonNormalImage` 0x1009ede0从RenderableImage矩形读取源宽高，调用绝对setSize并重新布局。原setter向量已执行，图片拷贝与Window通知是provider边界；这两个实际尺寸来自资源，而不是按钮比例。hover/pushed对应同名 `_1/_2` 图，disabled为空。

条背景是28×21的hdtd04.tga。`WLVertScrollbar::drawSelf` 0x100344b0对整个条pixelRect按源宽高平铺：14.3×94条为横1纵5次绘制，再由clip裁边；不是将背景拉伸到42高轨道。`WLVertScrollbar`原构造0x100347d0构造空RenderableFrame；Base构造0x1001e600清零全部八个frame图片指针。XML只设置条背景，不设置条边框，所以条left/top/right/bottom frame extent均为0。原updateImages0x100346c0对缺图写0。

`WLVertScrollbar::layoutComponentWidgets` 0x100343a0将减按钮放在(0,0)，增按钮放在(0,94-27)=(0,67)。原thumb宽取增按钮当前宽28。Base Window构造0x1003a0a5将ClippedByParent(+0x11f)设为true；按钮和thumb创建路径没有覆盖，所以28宽子窗口被14.3宽条裁掉右侧。edtDisplayBox本身XML的ClippedByParent=False不改变其子窗口设置。

`WLVertScrollbar::updateThumb` 0x10034a20消费：

- 起点 `start=decrementHeight+topFrameHeight`。
- 轨道 `track=max(0,scrollbarHeight-2*start)`，使用两倍减按钮高度，不是减按钮与增按钮高度之和。
- thumb高度 `max(minExtent,track*page/document)`；没有再限制到track。
- 移动距离 `travel=track-thumbHeight`，可为负。
- thumb顶部 `start+travel*position/(document-page)`。

原XML最小thumb为40。94高条得到start26、track42。doc300/page94时thumb40、travel2：pos0/103/206对应thumbTop26/27/28，已执行原updateThumb。短条50高时track0、thumb40、travel=-40；doc300/page50/pos125对应top6，原执行确认不会将thumb缩成轨道大小。范围为零时thumb算术存在除零输入，原应用通常隐藏该条；Web应按隐藏条件处理。

## thumb切片

背景 `gy0/dog_3.tga` 为20×7，上框 `dog_1.tga` 为20×28，下框 `dog_2.tga` 为20×17。normal/hover/pushed均使用同样上下框，disabled上下框为空。

Base `RenderableFrame::draw_impl` 0x1001e6b0已在原Image::draw调用边界执行28×40目标frame：上框目标y[0,28]，下框目标y[23,40]，两者重叠5像素；横向以20像素平铺，调用x[0,20]及x[20,40]，最终由目标与窗口clipRect裁剪。原图不压缩为一半高度。每次原draw选出的目的矩形见结果`thumbFrameDraws`。

`WLVertScrollbarThumb::drawNormal` 0x10034e90先绘制背景，再调用原frame绘制。背景沿y以源7像素平铺，内区扣除28+17高上下框。40高thumb的内区为负，不产生正高度中段；原背景仍进入一次尾部draw，由clipRect控制实际可见像素。完整图像裁剪与Windows帧缓冲未执行，不能由这些目的矩形声称逐像素截图一致。

## 范围、步长与事件

`WLRichEditbox::configureScrollbars` 0x10023380以格式行向量`+0x4a8..+0x4ac`的行数乘Font `+0xbc`行距作为垂直document；page为当前getTextRenderArea高度；step为`max(1,fontLineSpacing)`。这些字段依赖原字体与混合文本布局，不应把测试provider的16/18当成真实字体常量。原XML没有步长常量。

Base `setScrollPosition` 0x1009f340每次调用先钳制到范围，再调用updateThumb虚槽0x13c。只有实际位置变化才调用ScrollPositionChanged槽0x148；重复相同位置仍更新thumb。原执行覆盖负请求、范围内、超过底部、刚好一页及不足一页。

Base decrease/increase消费者0x1009f520/0x1009f4f0仅处理MouseEventArgs `+0x1c==0`左按钮事件，分别减/加step再调用同一原钳制函数，返回handled。滚轮消费者RichEdit 0x10022290优先选择可见且document>page的垂直条，否则尝试水平条；`position-=step*wheelChange(+0x24)`，并设置handled。

拖拽事件Base `handleThumbMoved` 0x1009f4d0调用垂直条`getValueFromThumb`虚槽0x140，再交给setScrollPosition。原 `WLVertScrollbar::getValueFromThumb` 0x10034b70是上述位置映射的逆运算。轨道点击方向入口0x10034450比较点击y与thumb上下界，返回-1/0/1；分页事件及自动重按的完整调度仍是CEGUI控件调度边界。

原 `onTextChanged` 0x10027980格式化文本后调用 `ensureCaratIsVisible` 0x10022110。后者给当前垂直位置加page+fontLineSpacing再钳制，并非直接赋底部最大值。已执行doc300/page94/line16/oldPos0→110；从远离底部的旧位置开始，单次文本变化可能只向下前进一页。Web消息到达直接scrollHeight是显示适配，不能称此原函数的精确消费者。

## 限制

原位置钳制、左右按钮步长、源图片设置按钮尺寸、thumb几何、上下框目的矩形、ensureCarat推进已执行。字体行距、格式行数、窗口size/position通知、绝对/相对坐标提供和Image最终绘制为显式provider边界。完整RichEdit XML解析、混合字体/表情行布局、原窗口图像裁剪和CEGUI事件调度尚未执行。Web使用scrollHeight/clientHeight以及消息到达直接到底部属于显示适配；本证据不引入完整CEGUI移植。
