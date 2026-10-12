# 原房卡目录背景（M5-02-C-BACKGROUND）

RoomCards正式将原roomlist.xml的ditu交既有SourceStaticImage，置于卡片与分页源控件之前。源窗口相对all为(0,0)–(615,316)，Image为gy0/data\ui\gy\daditu.tga，选用ui/imagesets_dds/gy_0.imageset的region60/0.png，615×317，HorzStretched、FrameEnabled=False、ClippedByParent=False。offsetY−84抵消sourceProps累加all.top84，保持既有615×321舞台投影；未替换全大厅锚点。背景自身pointer-events:none，无tab焦点，卡片及按钮按DOM顺序绘制在上。

room-card-background-native.py执行原RenderableImage::drawImpl0x1001f7e0以及Image宽高缩放0x10018640/100186e0，三个scale与full/narrow clip共6向量。615×317图片按原stretched consumer绘制到615×316窗口，目的矩形与剪裁逐项一致。Image::draw/GPU、窗口矩形与颜色端点为providers；Static默认/有效alpha来源复用既有证据。正式consumer内图explicit Horz/VertStretched，无frame，clip为inner rectangle。

同名gy0还有ui/imagesets/gy_0.imageset的region27/0.png，两者同615×317但RGBA不同。选DDS来自既有sourceProps优先imagesets_dds规则；原运行manager实际选源尚未证明，限定DDS消费不外推两图等价。

生产只新增SourceStaticImage import/ditu JSX及room-card-source-background absolute/pointer-events:none样式，未改资源消费者公共实现、业务、App或RoomControls。原picTopBanner无指定Image，未造图。

## 边界

此源背景不替代原完整大厅同状态截图、全窗口锚点或高清实际System display配套。Web面板仅作原PNG透明像素当前合成底，未当原背景依据；源图才是正式目录背景。原完整窗口/GPU及其余缺失控件仍留父项。
