# 原等待地图说明formatText消费者（M5-03-R-WRAP）

正式`SourceMultilineReading`使用原MultiLine `formatText`的段落、词分隔、行start/count/extent、前缀拟合和纵栏重排合同。`waiting-room-wrap-native.json` PASS13与`tests/source-multiline-layout.mjs` PASS13逐行对照：12个原入口终止向量，另一个原超宽首字零前缀向量以提交点有界停止，明确保留Web裁剪前进。

原执行脚本为`recovery/evidence/ui/waiting-room-wrap-native.py`，完整`MultiLineEditbox::formatText 0x1008fe70..0x10090260`、String `findFirstOf 0x10004c00`、Font `getTextExtent 0x10011130`和`getCharAtPixel 0x1000e5a0`实际执行。普通原入口经最终configure/invalidate通知到return；溢出向量由原入口显示纵栏并跳回格式化循环，第二次读取缩窄文字区。行向量append仅供存储，行start/count/extent由原消费者写出的12字节记录读取。

## 行与字体合同

原全局String初始化`0x10104430`从`0x10112654`构造词分隔符`\n\t\r`；`0x10109420`从`0x1011f028`构造段落分隔符`\n`，初始化代码保留在证据反汇编。空格不是词分隔符。段落切片包括找到的换行符，末尾换行不额外创建空行，空文字不创建行；连续换行各自形成原空白行。

原循环测量下一完整token。当前extent加token extent没有超过实际文字宽时消费整个token；超出且本行已有字符时提交已有字符；本行仍空时以原Font fitting-prefix取得可容纳的字符数。该prefix分支保留原extent=0，不将拟合字符的宽度补写到原行记录。最大行extent按这些实际记录更新。

`getTextExtent`读取glyph的Image宽+横offset，取累计advance加字形右边缘的最大值，并与最终advance取max；`getCharAtPixel`只累计glyph advance。两者分开供给正式`SourceMultilineMetrics.extent/advance`。原反例`ab`、宽6、Image inkExtra=.25：整token extent12.25，拟合前缀按advance6得到`a`，原行序为`a`、`b`，首行extent0。字形右边缘不能替代拟合advance。

文字宽、Font返回extent和每行extent存储在源float32字段；token extent与当前extent经x87相加比较后再存float32。正式消费者在对应字段边界使用Math.fround；额外分数字形向量将Image右边缘设为advance+.25，宽16.500001时`ab\t`原行extent16.5，下一行`cd`为12.25。

原行序覆盖中文、ASCII、空格、换行、连续空段、空文字、精确宽度、稍窄临界、tab/CR token、实际纵栏溢出重排、分数字形extent和extent/advance差异。原Font glyph advance为整数，本证据的Chinese12/ASCII6/tab4与newline/CR0是明确字体provider；分数来自Image宽/offset。

## 正式接线

`source-multiline-layout.ts`返回含text/start/length/extent的原行结构；正式React逐行显示这些记录，并以行数×16生成document。原183宽排版超过102页高时，在9.15纵栏显示后用173.85宽重排，沿既有原scroll消费者阅读。DOM只读data属性保留行索引供实际验收。

Canvas provider逐glyph读取SIMSUN的width作为advance、actualBoundingBoxRight作为字形右边缘，分别供给advance累计与max extent；newline/CR供应0。Canvas的字宽和字形边缘不代替原Windows Font映射。纵栏/箭头/透明thumb原消费者及区域证据沿`waiting-room-description-source.md`。

## 精度边界

CEGUI String substring/assignment及全局String存储、line vector append/free存储、glyph map查询与Image/advance、WL文字区域/可见性、最终configure/invalidate通知是provider；原段落/token选择、测量调用、拟合调用、行记录/最大extent、原溢出重排实际执行。configure消费者已有DESC原执行，不在本片重复通知取证。

原首字advance12而区域宽11时，原fitting返回0并生成start0/length0/extent0，cursor无法前进；取证在这一真实提交点停止。正式Web消费者保留一个超宽字并在区域内裁剪，避免阅读挂起；它是明确适配，该向量不声明原终止行序一致。实际183/173.85原地图说明没有这一超宽字情形。

本片交付wordWrap=true的正式阅读排版。原Windows glyph映射/advance/ink、字形像素与GPU/display、编辑/caret/selection及其它格式化模式保持父精度缺口。tab的token行结构已执行，DOM white-space:pre的tab-stop绘制仍为Web字体适配，不能据此声明原tab glyph或OS逐像素一致；实际MapInfo说明没有tab。
