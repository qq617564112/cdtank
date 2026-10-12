# 收到消息的混合排版（M5-12-E-R）

chat-rich-text.ts 是客户端独立排版规则；连续普通文字形成文本块，原30glyph形成独立序列项。正常收到TSRPC文字沿安全字面路径供应已经解码的文本/图像项，任意用户XML/HTML不进入DOM解析。原完整XML包装/解析没有执行，不声称Web已实现TinyXML或原服务器消息格式。

layoutChatRichText保持原字符像素前缀拆分、不按词换行、严格大于宽度才提交；表情不可拆分，超宽表情前置空行但不压缩logical advance；字体前缀返回0时原回退整段长度并允许该行溢出，末尾换行最终空行保留。line.items 的 x 是float32 advance累计。原10向量包含这些边界，且render绘制起点与目的矩形直接对照原draw调用。

ChatEmotes在正式原战斗面板中使用显式行和项绝对位置，行y按当前字体行距推进，不按图片高度扩行/垂直居中。图片left=logicalX+1，目的宽sourceWidth-1，logical advance仍sourceWidth；普通文字使用源SIMSUN字体。Canvas.measureText和当前CSS lineHeight16供应宽度/行距，明确为Web字体provider，不能称原Windows字体测量及光栅精确相同。源表情模型、帧资源与时钟沿已验M5-12-E-A，不另建相位或reset。

SourceBattleChat只通知原面板显示模式；ChatEmotes.observe真实日志可用宽变化，滚动条出现后扣除其源宽再排版，字体/序列载入后复用同provider重建收到节点。进入WAITING恢复旧Web inline显示，离房断开resize观察与动画RAF/行引用。原字体/整条RichEdit格式化与XML标签颜色、隐藏GUI调度仍属父项；Web内部glyph传输不冒充原A262线上编码。

只读data-chat-rich-line/item及x/width/height/text用于核对真实页面，没有生产诊断入口注入布局。正式构建不得导入native脚本或browser夹具。
