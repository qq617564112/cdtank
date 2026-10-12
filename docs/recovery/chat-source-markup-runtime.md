# 原收到聊天包装与解析（M5-12-E-X-B；E-X完整消费者未完成）

chat-source-markup.ts 在 interface/battle独立消费收到文字，内部glyph先按原41242a展开NNN/白色RGBA未引号emote属性，再以原colour白色根包装进入数据解析；不把收到消息插入innerHTML。原23向量执行0x10027370包装、嵌入TinyXML、节点遍历与文本/emote/colour项，Web对应项和色值逐组对照。

支持已实证的引号/未引号属性、已知/数字实体、原未知实体仅删&、空白保留、未知元素保留子文本、错误嵌套/不闭合产生空项；colour恢复沿原单保存槽，不改成栈。原tinyXML其它未测试语法不以规则对照声称全覆盖，XML声明/DTD/非ASCII元素名等仍需逐项源向量。网络请求/事件和dataset.chatText仍保留原权威文本，parse-error只影响显示，不改成功回执或伪造拒绝。

ChatEmotes正式战斗消息先解析再给已验原布局和共享序列，文本rgba驱动实际文字，表情默认alpha0仍占源宽和共享phase，生成glyph为白色alpha1。显式自定义非白表情RGB像素调制尚未恢复，属于完整表现父项，本片仅证明色值传递与白色/透明图像。image标签与缺少/未知sequence名称的原业务后果尚缺ImageManager/SequenceManager消费者；Web明确返回unsupported-source并字面回退，不把provider缺键当原拒绝。实际源入口和下一步见chat-xml-source.md。

原OS编码供应使用UTF8/UTF16，原ACP线上字节未恢复；TSRPC Unicode运输仍为适配。数字实体非ASCII legacy字节的转换未获完整Windows机器证据，不能称全部Unicode实体等价。字体Canvas度量和行距供应仍属E-R边界。

readonly data-chat-markup-status和data-chat-rich-colour记录正式显示合同，原布局advance、行和源图矩形继续沿E-R。消息确认、动画时钟和滚动生命周期共用现有实现。WAITING恢复旧Web inline显示，离房清行/观察/RAF；不引入服务端变更。

旧E-R浏览器证据中unknown标签字面显示为当时明确Web适配，本片原解析接线已替换此行为；其混排几何/临界宽度和历史生命周期证据仍有效，原未知标签当前显示应以browser-chat-xml.json为准。
