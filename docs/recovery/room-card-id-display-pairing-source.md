# 房间编号 display 与 Absolute 布局配套来源

原 GameBoxRenderer postD3DReset 0x10001c50 调用 gbGfxManager::GetViewport，读取viewport整数宽高，转float后交 setDisplaySize 0x10001480。后者写 renderer rect，并在尺寸变化时发 DisplaySizeChanged；renderer getSize 0x10001140返回保存的宽高。System::handleDisplaySizeChange 0x1002c5a0查询 renderer virtual+48 的 getSize，同一size先交ImagesetManager::notifyScreenResolution0x1001a680，再交FontManager::notifyScreenResolution0x10014c80，最后通知GUI sheet virtual+7c onParentSized。

room-card-id-display-pairing-native.py 将 GameBoxRenderer 原PE relocation至11000000，与 CEGUIBase 同一机器执行。三个800×600/1920×1080/3840×2160向量执行原postReset/setDisplay/getSize，完整System handler、两个manager真实单节点map遍历、此前已恢复完整Font/imageset通知与度量，以及完整Window::onParentSized0x10033f40的Absolute分支与getHeight0x10031ae0。gbGfx GetViewport值、renderer事件回调桥接、Window事件分派末端为明确providers；System/manager/字体算术不替代。

原 roomlist_icon.xml 的 all、btnRoom、txtRoomID均显式MetricsMode=Absolute。txtRoomID原窗口(−1,8)–(31,25)，32×17；原onParentSized Absolute分支0x10033ff7只从已有absolute rect更新relative rect，保持absolute尺寸。执行中以原120×120父窗口供给边界，通知之后三个显示尺寸均保持ID高度17。Font同时按display800/1920/3840通知取得对应factor与增长行距。这条原消费链不能证明高清字体与可读窗口布局已配套。

## 唯一未恢复连接

gbGfxManager::GetViewport的实际D3D viewport来源及应用在显示变化前后对原Absolute房卡窗口进行的布局覆盖尚未取得。其准确入口为 GameBoxRenderer postD3DReset→GetViewport→setDisplaySize/DisplaySizeChanged→System handler；不能从任意Web stage尺寸推导原运行时display和窗口配套。原完整Windows/GPU截图仍缺。正式MediumHT保持实际调用已恢复pure consumer的800×600基准，独立Web stage投影；既有三res可读编号/选房/paging验收复用，M5-02-C-IDTEXT-SCALE保持未勾选。
