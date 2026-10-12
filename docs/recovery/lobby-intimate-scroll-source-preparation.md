# 大厅密语长名单源纵栏准备

UI05 / M5-12。chat_intimatelist.xml 的原 lstIntimate 为 WindowsLook/Listbox，108×111，包含纵栏轨道、上下按钮与 thumb 的 14 个图片状态。现正式消费者在长确认名单上使用 overflow:auto，仍显示浏览器默认纵栏。

独立 LobbyIntimateScrollbar 与专属 CSS 已接入原正式菜单。原图只读映射、WLListbox 既有原 primitive 合同复用；原 factory 宽与未写入 XML 的 thumb 最小值没有新证据。当前模块明确提供 Web 宽 8.5、18 行步进与 53 物理像素 minimum，范围和 scroll extent 沿真实 DOM。菜单行、原目录顺序/账号、chooseTarget、中文草稿与 caret 由已有消费者保持。仅已处理的 Home/End/Arrow/Page down/up 在纵栏消费，Escape 继续送到现聊天根关闭合同。

拟由 lobby-chat-intimate.tsx 仅接列表 shell/ref 与该新模块，专属 CSS 将原 overflow:auto 改内列表 overflow:hidden。共享字体、聊天文字、store、presence 生命周期与过滤不属于此范围。主线已释放具体 shell/ref 归属并完成接入；最新运行缺口见 lobby-intimate-scroll-source-page.md。

browser-lobby-intimate-scroll-source-page.mjs 已准备 10 个普通 Account 客户端与两正式 React 页面，共 12 个真实目录账号，数据不注入。首次只收长名单 1920 完整菜单图及箭头/滚轮/thumb capture 松手、Home/End、源 Escape 取消和键盘选择返回输入/caret；不发送、不建房、不购买，旧菜单三分辨率与权限证据复用。runner 语法检查通过，两份 raw 及当前未验收边界见最终页文档。

接入合同已具名：原 lstIntimate sourceProps 留在外 shell；内 div 保 role=listbox、目录 binding、原 options/callback，并新增 HTMLDivElement ref/data-lobby-intimate-list。纵栏与内列表为 shell 同级子项，只读取 ui 与 lstIntimate.properties。外 shell 继续原完整父链位置，内列表 inset=0、100% 尺寸；CSS 不改任何字体，原帧/选择图片保持。
