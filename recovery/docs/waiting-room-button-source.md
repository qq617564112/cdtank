# 等待房间原按钮消费者（M5-03-R-BUTTON）

正式等待与建房页共同使用 `interface/resources/source-button.tsx`。两页采用明确layout suffix、控件名与坐标offset，共用已有ButtonBase capture/state及WLButton/WLRadioButton图片层；等待Ready/Cancel/Team/Invite/Close沿原请求actions，不改变房间规则。

`waiting-room-button-native.py` 复用 `source-button-native.py` 原执行入口，实际room_main六控件64个完整状态/selected/alpha向量与5个pointer dispatcher向量PASS。Ready/Cancel/Invite/Close为WindowsLook/Button、UseStandardImagery=False；Team实际为WindowsLook/RadioButton，由源JSON type识别。所有控件StateColorBlend=False，Text/Font/Alpha属性缺省，图上文字是原PNG，按钮不追加可见标签。

Ready/Cancel/Close没有DisabledImage，禁用时无custom图片，不回退Normal；Invite有原DisabledImage。Team selected正常/hover使用Pushed背景加CheckMark，selecteddisabled使用Disabled背景加CheckMark。每层沿原effective alpha绘制，原执行alpha1/0.5四角一致；现布局alpha1，PNG透明度保留，HTML禁用不额外淡化。

实际源分派与捕获鼠标规则复用 `room-create-button-source.md`：hovering=pointerInside XOR pushed，captured按下在内Pushed、拖外Hover、返回Pushed；释放外不执行click。键盘Space/Enter沿HTML激活并有held状态，focus/blur/cancel/lostcapture/disabled清理。关等待面板仅卸载源视觉子树以释放capture，不改变WaitingRoomSession的资源、notice、busy和generation请求所有者。

## 精度边界

Team selected取当前权威local.team投影，这是Web现房间语义；原room callback/setSelected上游未据此恢复。notice后焦点沿既有Web等待页规则恢复可用原控件或Ready，原OS焦点链未证。此片证明原按钮图片/alpha消费者与正式交互，不关闭等待页frame/font/scale、原OS事件、GPU/display或原服务规则。800×600等待面板保留已有overflow/滚动适配，源控件逻辑矩形不改。
