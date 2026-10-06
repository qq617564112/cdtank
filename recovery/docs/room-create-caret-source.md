# 建房原光标来源与消费（UI-07-R-CARET）

房名与密码原CaratImage均引用 `set:gy0 image:data\\ui\\gy\\guangbiao.tga`，对应 `ui/regions/60/237.png`，原atlas尺寸1×12。正式同一RoomCreateDialog的两个原生input使用该图片绘制光标，原生caret透明；图片层aria-hidden、pointer-events:none，不持有输入值或编辑状态。

`recovery/evidence/ui/room-create-caret-native.py` 执行完整WLEditbox draw `0x1000a420..0x1000aede`，7向量核对房名/密码、正反选区、失焦、readOnly与隐藏阶段。原caret消费者 `0x1000a7f0..0x1000a8a4` 检查readOnly、焦点、image非空和visible字节，目的矩形使用光标前缀extent作为x、图片宽度作为width，跨整个text area高度拉伸。当前原指令提供者extent7、line16、image宽1、text area136×16；结果为 `[caretIndex×7,0,caretIndex×7+1,16]`。

原构造 `0x1000b1f6` 默认半周期0.5秒；`0x1000b110..0x1000b168` 使用float elapsed累加，elapsed>0.5时隐藏，elapsed>1时归零并显示，边界相等仍沿前一分支。原5更新向量执行通过，其中elapsed0.5加1e-9时隐藏而存储elapsed仍为float32的0.5。正式 `room-create-caret-clock.ts` 消费相同float32输入累加、未舍入sum严格比较及float32 elapsed存储；requestAnimationFrame提供秒delta，直接写图片opacity，卸载取消frame。

正式图层从原imageset AutoScaled/800规则取得整数图片宽度，缩放后回除舞台scale。位置沿原生selectionDirection选择start或end，由当前正式源字体测量前缀并减原生scrollLeft；密码只测星号串。原draw `0x1000a77d..0x1000a7c2` 为caret图片保留右边宽度，Web在native scroll已到右端时将图片左边限制到clientWidth−imageWidth，这是保留当前原生scrollLeft的Web滚动适配，不是原draw里的clamp；原上游scroll offset及Web原生scroll的逐值等价仍未恢复。外层按输入text area裁剪，失焦/readOnly/disabled隐藏，选区与password掩码保持已交付消费者。

## 精度边界

字体extent7/line16是原指令执行提供者，不是原OS字体测量；Web采用当前正式字体宽度与native range/scroll。原时钟调用者由Web rAF delta适配，原OS输入、IME候选窗、字体OS、GPU/framebuffer/display不由此关闭。当前密码长度及range沿Web原生UTF16接口；原String码点计数边界仍在PASSWORD父项。
