# 房间编号原 Static Font 缩放（M5-02-C-IDTEXT-SCALE）

SourceBitmapStaticText 现消费原 MediumHT 静态字体的分辨率通知算术：注册 imageset 先收到 display size 通知，图片尺寸原 float32 乘法后整数舍入；字体再保存 display/native 的两个 float32 因子，更新每个整数advance与垂直度量。真实房间完整ASCII编号及原十数字图片、颜色、missing-ASCII分支复用 IDTEXT 来源。

Font::notifyScreenResolution 0x10012190 对 +a8/+ac 注册imageset数组逐个调用 Imageset::notifyScreenResolution 0x10018de0，原update0x10018d40/map迭代/Image宽高offset整数舍入完整执行。字体将显示宽高除 native800/600分别存+16c/+170；AutoScaled+168为true时调用 Font::updateFontScaling 0x10011910。静态分支逐glyph将原整数advance+18乘xFactor，原CRT ftol 0x100fddb8向零截断，写当前advance+14。Font::calculateStaticVertSpacing 0x1000ddd0取已经缩放取整后的图像最大高度，再乘yFactor，结果float32存lineSpacing+bc；offset0使baseline0。原图像目的矩形使用取整后的图像宽高，未再乘一次字体因子。extent是各目的右边与累计advance的最大值。

纵向行距的第二次因子按原消费者保留。例如显式1.8输入时，10/7宽图变18/13、高14变25，advance为17/12，lineSpacing45，R1 extent13、R10 extent30。scale3时图高42、lineSpacing126，51高窗口居中top−38，图像底部4像素可见。此结果来自原字体通知与StaticText消费者。

room-card-id-font-scale-native.py 执行完整 Font notify/update/metrics、原 imageset notify/整数round、原CRT ftol、extent/drawLine，共8通知向量与32文本向量，包含1/1.8/3/1.07/3.6及当前800和1080p实际stage输入。AutoScaled=false向量证明图片仍接收通知但字体不更新advance/原lineSpacing。另执行原StaticText居中0x100b0f2c–0x100b0fdf八向量，覆盖正/负/零和半像素：非负加.5后ftol，负减.5后ftol，结果存float32。原字体和图像map对象、显示尺寸、末端render为providers，消费者执行原机器码。

mediumHtMetrics(glyphs, sourceViewport) 是独立纯消费者，显示宽高先各自转float32，除原native尺寸后各自再存float32；image尺寸round(f32(nativeDim*factor))，advance trunc(nativeAdvance*storedFactor)，lineSpacing f32(roundedHeight*yFactor)。tests/room-card-id-font-scale-metrics.mjs 对七个AutoScaled原通知向量逐字形比较尺寸/advance/行高/baseline，全部一致，包含实际800与1080p Web舞台输入的两factor来源。

正式SourceBitmapStaticText实际调用该消费者，明确sourceViewport={width:800,height:600}。原十glyph度量、extent最大值与StaticText居中形成可读baseline编号，由既有Web stage独立投影至800/1080p/4K；data-source-font-viewport标记800,600。字体sourceViewport与Web投影stage不是同一输入。SIMSUN分派、目录业务、CSS、SourceButton均未改。

## 边界

原显示消费者以显式sourceViewport参数恢复，正式页面当前采用原800×600基准。原System/renderer实际OS display生产者及完整窗口锚点仍留父项；原HD显示与窗口布局联接未恢复，M5-02-C-IDTEXT-SCALE保持未完成；本片证明原缩放消费者与正式baseline使用，未证明原Windows完整宽屏画面或GPU framebuffer。原编号字符串格式生产者仍未知，业务R前缀不移除。当前路径仅真实ASCII编号；outline SIMSUN房名回退沿既有消费。
