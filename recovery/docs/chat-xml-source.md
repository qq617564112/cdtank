# 收到消息 XML 原包装、解析与项消费

`formatText 0x10027370`、DLL 内嵌 TinyXML 文档解析 `0x10003bd0`、根节点获取 `0x10001450`、节点遍历 `0x10027100`、元素开始 `0x100261a0`、文本项消费 `0x10026c10` 和最终行提交 `0x10026110` 均实际执行。23 组正常输入、标签、实体、颜色和格式错误向量通过；输出是原节点消费者产生的 items，见 `recovery/output/chat-xml-source.json`。运行：`recovery/.venv/bin/python recovery/evidence/chat/chat-xml-source.py`。

原接收转换循环 `CDTank.exe 0x004124ab–0x00412589` 实际将 `你好▁中国` 转为 `你好<emote name=001 red=255 green=255 blue=255 alpha=255/>中国`。循环从末尾遍历原字符，供应 CEGUI 字符索引、向量 prepend 和 CRT 三位数字格式值；字符分类、标签各部分的选择和排序由原指令执行。此生成字符串随后进入原 format/parse/consume，得到白色文本、001 表情、白色文本三项。

## 可接语法与消费合同

包装模板是 `<colour red=%d green=%d blue=%d alpha=%d>` 加完整消息加 `</colour>`；没有转义、属性补引号或未知标签改写。颜色参数来自控件颜色乘255的原转换。`0x10027732` 供应解析 encoding=2；没有通过 CEGUIBase 的 XMLParser。`0x100274fb` 将 TinyXML 全局空白折叠开关 `0x10075310` 设为0。

| 输入片段 | 原解析与消费 |
| --- | --- |
| `你好` | 白色文本项 |
| 完整接收生成的 `<emote name=001 red=255 green=255 blue=255 alpha=255/>` | 001 表情项，颜色全1 |
| `中文<emote name=001/>` | 中文文本加001表情项，缺省颜色全0；表情仍占原尺寸 |
| `<emote name="001"/>` | 同未引号属性结果 |
| `你好&amp;中国` | 单文本 `你好&中国` |
| `甲&#x41;&#65;乙` | 单文本 `甲AA乙` |
| `甲&bogus;乙` | 单文本 `甲bogus;乙` |
| `你好 & 中国` | 单文本 `你好  中国` |
| `甲&lt;tag&gt;乙` | 单文本 `甲<tag>乙`，实体结果不再作为标签解析 |
| `你好<tag>朋友</tag>中国` | 三文本项 `你好`、`朋友`、`中国`；未知标签自身不生成项 |
| `你好<tag/>中国` | 两文本项 `你好`、`中国` |
| `甲<tag`、`甲<tag>乙`、`你好<中国` | 原 parser 错误分支，清理后的 items 为空 |
| 前后空格、连续空格、Tab、换行 | 原文本节点保留，换行随后进入已有原布局 |
| `<emote …>中</emote>` | 先生成表情项，随后消费子文本 `中` |

原遍历逐个消费 type4 文本节点，对 type1 元素递归；其他类型没有文本项消费。未知元素不会把其子文本隐藏。标签结束不为表情增加项。

`colour` 属性缺省0；原元素开始保存当前 ARGB 到控件 `+0x52c`，更新 `+0x528`；元素遍历结束若名字为 `colour` 则从这个单槽恢复。`A<colour red=255 green=0 blue=0 alpha=255>红</colour>B` 的文本 ARGB 依次为白、红、白。双层 `A<colour red=255 green=0 blue=0 alpha=255>R<colour red=0 green=0 blue=255 alpha=255>U</colour>C</colour>D` 得到白、红、蓝、红、红；外层结束沿用内层覆盖后的保存值。此处不能换成颜色栈。

## 执行边界

CEGUI String/XMLAttributes 和 MSVCP string 的值、CRT 字符分类/内存分配/格式化、Windows 编码转换、字体度量及已恢复序列指针由 provider 供应。Windows 编码 provider 使用 UTF-8/UTF-16；原转换函数实际执行，但原机器 ACP 字节行为没有恢复。未使用 Python XML 或 DOM 替代原 TinyXML。原 TinyXML 创建、解析、实体处理、属性链和树遍历都执行原 DLL 指令。

正常组在原最终行提交后 `0x1002778f` 停止；XML 错误组在原错误分支 `0x10027884` 或空根分支 `0x10027914` 停止。滚动、绘制和完整错误日志不在本入口内执行，已有排版消费者向量继续有效。

额外三组边界保存在 JSON 的 `boundaries`，不计入23组通过向量：`<image name=001/>` 已解析并进入真实 image 消费者，在 `0x10026a5a` 调用 IAT `0x1003d160` 的 `ImagesetManager::getSingleton` 时缺 provider；继续需要原 imageset/image 名称 lookup。`<emote/>` 和 `<emote name=999/>` 均已解析到真实 emote 消费者，但序列 lookup provider 只供应已恢复001–030；缺名称和不存在的序列在原 `SequenceImageManager` 中究竟如何异常尚未执行。不能据这两个 provider 拒绝结果声称原 parser 拒绝标签。
