# 建房 StaticText 裁剪（UI-07-R-TEXT）

源XML的txtMapName、txtLowBound、txtHighBound为WindowsLook/StaticText，HorzFormatting=HorzCentred、VertFormatting=TopAligned，拥有各自源矩形。正式React仅这些文字节点加入room-create-source-text，overflow:hidden、nowrap、center；frame图像span保持自身原裁剪与绘制规则。

`room-create-text-clip-native.py`实际执行CEGUIBase.dll的StaticText::drawSelf前缀0x100b0db0–0x100b0df2。源消费者从虚槽+0xe8取得文字区域，从虚槽+4取得窗口clip，再实际调用Rect相交0x1001deb0。三组向量确认clip取文字区域与窗口clip交集。文字区域、窗口clip与静态背景为provider，停止在字体加载之前；字体测量、行格式化、文字draw及GPU均未执行。

当前Web文字位于源文字矩形中，通过CSS矩形裁剪保留区域边界。默认字宽/字体继承、原长文本自动换行以及最终glyph剪裁像素仍未证明完全等价。源map正常名字由实际网络提供，长map展示夹具明确是生产React组件props夹具，不声称原网络生产长地图名。玩家中文房名与密码输入沿现原生输入，不改变过滤或业务。
