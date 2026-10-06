# 原聊天表情序列图片消费者

原收到聊天的emote标记使用按名字取得的`SequenceImage`，不是输入框字体的基础图。001–030分别消费同名`.seqimage`，显示序列中的`NNNb_i.tga`帧；原RichEditbox将这些序列设为无限循环。帧持续时间来自每个原序列文件，不能统一为100ms。

`recovery/.venv/bin/python recovery/evidence/chat/chat-emote-render-source.py`：PASS。结果`recovery/output/chat-emote-render-source.json`记录30份默认序列的帧序、持续时间、PNG、原矩形和完整原时钟/绘制选择执行。

## 原tag到序列

`WLRichEditbox::onTextChanged`0x10027980调用`formatText`0x10027370。XML元素消费者`elementStart`0x100261a0的表情分支0x100263db–0x10026862读取name与颜色属性，在0x100266cd调用`SequenceImageManager::getSequenceImage(name)`。返回的原序列指针放入布局项；以序列`+0xb8/+0xbc`作为图宽/高，0x10026735将序列`+0xac`循环次数写为-1。

原EXE0x453951–0x453a18枚举`data\ui\sequence_images`内`.seqimage`文件并调用序列管理器创建。每个文件定义Name、FrameCount、LoopCount以及带Index/Duration/Imageset/Image的ImageFrame。默认001的两个帧是`001b_1.tga/001b_2.tga`，各0.2秒；001A另定义`001_1.tga/001_2.tga`，name=001不会选择001A。全部默认30序列的真实路径保存在结果中。

原Base DLL序列load0x100283d0经XML解析器加载；处理器虚表0x10111810的elementStart为0x10028c50。原构造/加载后将elapsed和完成循环次数清零，calculateTotalTime0x100273c0求各帧Duration的float32总和。

## 原时钟与绘制边界

`CEGUIBase.dll SequenceImage::update`0x100270c0完整行为为：

1. `elapsed(+0xa8) += delta`，写回float32。
2. 只有elapsed严格大于totalDuration(+0xb4)才处理跨周期。
3. loopCount(+0xac)小于等于0时不增加完成次数，并只减一次totalDuration；这是单步if，没有while或取模。
4. 正循环数达到最后一次时，完成次数(+0xb0)设为loopCount，elapsed钳制为totalDuration；draw随后不绘制。

RichEditbox将loopCount覆盖为-1，所以正常显示无限循环。`draw`0x10027410从头累加float32帧持续时间，选择第一个累计时间大于等于elapsed的帧。elapsed恰等于第一帧Duration时仍显示第一帧；多出一个正delta才换第二帧。elapsed大于所有帧累计时间时没有绘制；大delta只能减一次周期，可能出现这种情况，不能用模运算改写。

脚本对全部30序列执行原calculateTotalTime/reset/update/draw，以ImageFrame实际绘制函数0x10018780作为记录边界。验证初始帧0、第一边界仍帧0、边界后下一帧、跨周期与大delta，以及有限一次循环结束后无绘制。源图片并未由钩子决定，钩子只记录原选择的帧索引。

## 布局、共享和释放

表情宽度加入当前行宽；0x100267f0–0x10026858以行宽加图片宽与可用区域比较，超过时提交上一行并在新行放表情。布局项携带图片尺寸与颜色，renderTextLines0x100243e0在0x10024859调用SequenceImage::draw。当前代码静态确认使用图片宽度进行换行，未执行完整混合字体/滚动布局，不能据此声称逐像素布局复刻。

序列管理器getSequenceImage0x10029290从名字索引记录返回已有指针，没有克隆。RichEditbox0x10026764–0x100267c8按指针去重，将序列放入`+0x478..+0x47c`。updateSelf0x10024920遍历这份列表，每个唯一序列每次调用推进一次delta。同一控件重复同一个表情不会重复推进时钟；多个控件若同时调用updateSelf，会推进它们共享的管理器序列指针。

formatText0x100273c0–0x10027442清空旧序列指针列表和布局项，未在该路径销毁管理器提供的SequenceImage。它不会在表情元素开始时调用reset；下一次显示使用共享序列的当前时间。资源的总销毁属于SequenceImageManager。清空文本重建后不再保留旧表情的tick列表；窗口隐藏后是否仍由外层GUI更新，当前入口没有证明。

## 限制

XML属性查找、原序列提供、行宽与释放路径为保留逐指令静态证据；完整RichEditbox tag解析、混合文本/图像布局和跨控件更新调度尚未执行。原30序列时钟与draw选择已经执行，但这些不能替代完整收到消息的图文消费者联机验收。Web的独立动画相位、隐藏时钟与释放若采用不同规则，应标明重建显示适配。
