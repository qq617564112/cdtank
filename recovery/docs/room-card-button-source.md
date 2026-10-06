# 房间卡片原 Button 捕获状态（M5-02-C-BUTTON）

正式 `RoomCards` 使用资源层 `SourceButton` 消费 btnRoom 的普通按钮图态与捕获状态，保留原卡片文字、图片子控件、目录选择、aria-pressed 与普通 Join 接线。永久选房身份不再覆盖原指针图态。

`roomlist_icon.xml` 的 btnRoom 是 WindowsLook/Button，StateColorBlend=False、UseStandardImagery=False，提供 NormalImage/HoverImage/PushedImage，没有 DisabledImage 或 CheckMarkImage。`room-card-button-native.py` 复用已恢复原 WLButton 四个完整 draw 入口（0x10004d70/0x10005070/0x10005370/0x10005670），八状态/alpha 向量 PASS；普通、悬停、按下分别绘制自己的源 custom 图片，禁用缺图时零 custom image draw。禁用不绘制按钮底图，独立文字与模式/队伍子图仍绘制；不以 NormalImage 补禁用底图。有效 alpha 默认1，disabled 不另乘透明度，原 getter 证据复用 room-card-text-alpha-native.json。

原 ButtonBase updateInternalState 0x1003f9e0 与 drawSelf 0x1003fba0 的五指针向量复用同一原执行：hover=inside XOR captured-pushed。因此普通移入 Hover，内部捕获按下 Pushed，捕获拖出仍 pushed=true 而图态 Hover，返回 Pushed；外部释放取消普通选房，内部释放才触发现有选择回调。DOM pointer capture、hit test、pointercancel 与键盘激活是明确 Web 输入投影。

共享 SourceButton 仅新增 roomlist_icon.xml suffix、保留传入 className、图层之后绘制 children。原 radio 状态/CheckMark、默认图态、alpha 和事件逻辑不变。卡片文字与图片仍在按钮 image i 层之后，image i 的 pointer-events:none 保持普通按钮命中；create/waiting 使用原默认分支。

## 来源边界

原 EXE 0x507b6e..0x507b9c 查 RoomIcon0/btnRoom 并写 controller+0x60，十槽数组步长0x34。目录更新 0x5071d6..0x5071e3 将三图片 key 交给0x4d92fd；此链没有证明永久 selected 图态生产者。btnRoom 不按 RadioButton 处理，正式 selected 只保留目录身份与 aria-pressed。原永久选中表现、完整回调、目录动态图片 key 的上游资源选择留父项。

原 Window 对象、窗口矩形、有效 alpha、空按钮标签及绘制端点是明确 provider，图态分支与 custom image 消费执行原代码。原完整大厅 Windows/GPU截图未取得，现有外框、工具栏、缩放与编号仍是既有 Web 投影；本片不声明整个大厅1:1。

卡片 `background-color:transparent` 避免 HTML button 默认底色在原 custom image 零 draw 时形成替代灰板。按钮透明区域露出当前 Web 父面板；该父面板颜色不是恢复的原 Windows 大厅背景。
