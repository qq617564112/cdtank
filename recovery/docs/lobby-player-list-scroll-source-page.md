# 大厅玩家名单源纵栏消费者

UI41 / M5-02 / M5-13。正式大厅真实玩家名单使用 playerlist.xml 的纵栏背景、上下箭头和 thumb 图片，保留现账户名单、选中、密语和资料入口。PlayerList 原170×420主要区域在大厅(619,155)；原属性 VertScrollbarThumbMinExtent 为53。

原 WLListbox::getListRenderArea（0x1000ffd0）四向量及 layoutComponentWidgets（0x100102f0）两向量已执行，证据分别见 `lobby-player-list-source.json` 与 `lobby-player-scroll-layout-native.json`。初始纵栏宽8.5为明确提供值，原factory producer未证。纵栏的26/27上下按钮、H−52轨道与thumb算术复用 `chat-scroll-source.json`、`waiting-room-description-native.json`。14处图片映射见 `lobby-player-list-scroll-source-page-source.json`。

消费者以实际 DOM scrollHeight/clientHeight 为文档和页高，沿现14px行、白字SIMSUN TTF；栏宽8.5、行步长14及滚轮像素/页面换算均为Web provider。原最小53按实际页面缩放转换为逻辑值；比例thumb由当前文档高度计算。列表隐藏时清除拖动，捕获外释放、blur和卸载清理；箭头命中取28宽资源与8.5宽可见区域交集。现数据、回调、网络轮询、权限及好友事务沿既有owner。

整页滚动实际 `browser-lobby-player-list-scroll-source-page-2026-10-05T00-06-42-497Z.json` PASS。35名普通WsClient通过Account及DisplayName认证，加一普通React账户；真实LobbyPlayers确认36行，与DOM逐ID/name相等。未注入目录、库存或资金，未发送聊天、建房、购买或关系写。三张800×600、1920×1080、3840×2160完整大厅图已亲看，名单与源纵栏可辨；各页文档504、可见420，纵栏宽随pagezoom为8.5/15.3/30.6。

普通滚轮从0到39；箭头按下Pushed、外移Hover保持capture，外释放Normal且scroll39不变；内部点击到53（14步长）。thumb捕获拖动53→0、外释Normal无capture。nativeEnd到84，Home回0，滚动键未到window。普通行ShiftF10打开既有资料，nativeEscape关闭并返回同一账户行；window仅记录既有行F10，未记录新的滚动键或资料Escape。

统一 `mend-complex-map-production-web-build-final.log` 严格Webtypes/Vite exit0（1m31）已包含源纵栏消费者；后继handled-row键盘隔离hunk等待下一必要统一types/build，不据该日志声明新hunk已发行。源码、原执行、运行与截图索引见专属source/accepted文件。进程、普通WsClient、浏览器和临时库已清理。

## 未完成范围

原factory栏宽、原名单文档/字体绘制provider、横栏与长名裁剪保持未知。36行实际使用较大的比例thumb，未另构造最小53极限。现handled-row ArrowUp/Down/Home/End/Enter/ShiftF10的keydown/keyup已隔离。资料modal关闭后keyup Escape会到达恢复焦点的row，该另scope仍开放。完整UI41/大厅1:1父项保持开放。

已处理名单键的补充隔离采用 `browser-lobby-player-list-scroll-source-page-2026-10-05T00-11-10-754Z.json` 有效段：ArrowDown/Up/End/Home按1/0/2/0移动，ShiftF10资料返回同账户行，Enter选择真实名单目标并保持“键盘选择草稿”与inputfocus；这些键keydown/keyup未到window。raw整体FAIL原样保留，唯一window事件为modal关闭后的keyup Escape。该键由已卸载资料dialog返回的row接收，超出本片已handled键范围；不扩row Escape处理。该尾段0新截图、无重复scroll/capture，无发送/房间/购买或关系写。新名单键hunk保持原业务回调与未handled快捷键，最终发行由主线下一必要batch纳入。

主线有限组合接受状态为 `PASS_COMPOSED_PLAYER_LIST_SCROLL_CONSUMER_SCOPE`，accepted.mainReview与keyboardTail保存准确范围；原FAIL状态保留，UI41/完整大厅父不关闭。
