# 原 Login 字符键盘

UI-28 keyboard.xml 为独立55控件页面，包含47字符按钮、Shift、Caps及源装饰。原Login初始化在4c17bc加载窗口并保存owner+4c，字符控件保存owner+50起的连续47项。它与游戏按键设置页不同。

[可复现原来源](../../recovery/output/login-character-keyboard-source.json)包含原布局、逐键字符映射、初始化、订阅和完整点击回调。47按钮在4c6e92逐个订阅Clicked→4c0001。回调先激活密码框owner+24；Shift(owner+10c)与Caps(owner+110)状态不同使用上字符，相同使用下字符，然后经CEGUI System.injectChar输入，最后setSelected(false)清除Shift。Caps保持。

密码框Activated订阅回调4c3197。回调将634ee8的原模式字符串与“Q”比较；不相等且Login尚无该子窗口时，通过addChildWindow挂载键盘。4070e2传字符串长度到4037f3，后者使用原SSO长度及memcmp比较。原参数解析41a605中，模式参数“QQ”经401609赋值“Q”，因此该模式抑制键盘挂载。原认证与频道权威producer不在该来源范围内，保持未知边界。

当前 Login 密码使用标准输入框。

47字符按钮、Shift、Caps及装饰的逐项控件名与图片引用由[可复现原来源](../../recovery/output/login-character-keyboard-source.json)与keyboard.xml给出。
