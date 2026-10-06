# 建房按钮原状态与图片消费（UI-07-R-BUTTON）

正式RoomCreateDialog全部PushButton与RadioButton已使用共用 `interface/resources/source-button.tsx` 的 `SourceButton` 消费原按钮状态。布局、业务资格、native按钮激活、原资源图片、友伤草稿与提交路径保持同一正式对话框；此source消费者同时用于等待房间，旧其它页面按钮保持原模块。

`recovery/evidence/ui/room-create-button-native.py` 执行48个完整WindowsLook状态/图片/alpha向量与5个完整ButtonBase指针/分派向量，输出 `recovery/output/room-create-button-native.json` 为PASS；原指令保存 `room-create-button-native.disasm.txt`。Window外框/text area、有效alpha、空标签Font及String、colour构造/复制/setAlpha、Image/RenderableImage画图为明确提供者，状态分支与矩形算术执行原代码。

`ButtonBase::drawSelf` `0x1003fba0` 优先hovering，再pushed，再disabled，最后normal。`updateInternalState` `0x1003f9e0` 在本控件持有capture时将hovering设为“pointer下控件是self”与pushed异或。普通未按鼠标在内是Hover；捕获按下在内是Pushed，拖出是Hover，回入是Pushed。正式pointer capture保留held直到释放、取消、失焦或disabled；在控件外释放不执行按钮业务。

原WLButton完整四draw入口为 `0x10004d70/0x10005070/0x10005370/0x10005670`。建房PushButton `UseStandardImagery=False`，分别消费Normal/Hover/Pushed/Disabled custom RenderableImage；对应图不存在时不画该custom图，不替换成Normal。btnOK/Cancel/Close没有DisabledImage，disabled期间没有custom图；箭头禁用使用原DisabledImage。

原WLRadioButton四draw入口为 `0x1001cf30/0x1001d270/0x1001d5b0/0x1001d8c0`。原RadioButton构造 `0x1009a8d4` 默认DrawAsPushedWhenSelected=true；selected的Normal/Hover转Pushed draw，背景PushedImage后另画CheckMarkImage。Disabled draw始终先DisabledImage，selected时再画CheckMarkImage。因此selected+disabled不是单一图片优先级。正式友伤与只读模式控件均按两层顺序绘制；本布局图像目的矩形与按钮框相同，友伤98×41、模式98×40。

原建房StateColorBlend=False；每张图片沿有效Window alpha绘制，native向量alpha1与0.5分别得到四角同alpha。正式源布局有效alpha为1，图片层各自opacity1，PNG自身alpha保留；disabled不叠加HTML额外淡化。

## 精度边界

HTML Space/Enter提供键盘激活与held视觉适配；原ButtonBase鼠标入口和图片消费者已执行，此片不声称原OS键盘事件入口已恢复。Web pointer capture/hit test、焦点、blur与cancel适配DOM，原程序framebuffer、字体OS、GPU/display以及其它已保存特殊prefix缺口仍未完成。
