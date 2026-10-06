# 大厅聊天历史源纵栏

UI01 / M5-02 / M5-12。原chat.xml ChatTextBox为WindowsLook/RichEditbox，原主要日志区域(20,437)–(594,551)，574×114。正式日志现使用原控件映射与完整纵栏资源，消息、账户身份、频道、发送与菜单保留现owner。

原14处纵栏图片引用与minExtent53见 `lobby-chat-history-source-page-source.json`。原WLRichEditbox::layoutComponentWidgets 0x10022a70相对纵栏尺寸0.05×1、位置0.95×0，574宽对应28.7；不同于Listbox factory未证的8.5。原范围钳制/26及27按钮/轨道H−52/thumb max(minExtent,track×page/document)/可能负travel来自已执行 `chat-scroll-source.json`。以本页XML53替代战斗页XML40，实际minimum/scale桥接保持已确认原像素阈值边界。原gy0 thumb上29、下17及中7源图消费，不造新图片。

本片独立LobbyChatHistory与专属Scrollbar/CSS，只替换LobbyChatView历史呈现。DOM文档高度、现16行高、普通文字与SimSun Web字体为明确provider，收到消息直接autoBottom保持现行为；原ensureCarat的page+line推进未由此冒称恢复。空/不足一页隐藏纵栏，资源commit与resize/文本变化重新测量；指针外释、blur、卸载清捕获，滚轮、键盘及箭头保普通阅读操作。

实际 `browser-lobby-chat-history-source-page-2026-10-05T00-39-45-834Z.json` PASS。两个正常认证账户通过真实公共消息形成19行，page114/document304。完整800/1920/3840大厅图均已亲看，消息与纵栏可辨。wheel到140，箭头捕获外移Hover/外释Normal不滚动，内点击140→124；thumb124→98并正常释放，Home0/End190；新消息document320自动到底206。window keydown/keyup均空，无room/BUY/关系写入，临时服务与浏览器已清理。

工程复用 `lobby-scroll-consumers-production-web-build.log` 严格类型和标准构建PASS1m24，未重复构建。专属source/accepted记录有限consumer范围，主线已亲审有限范围。原混排/字体/GPU/事件调度和完整UI01父项仍开放。
