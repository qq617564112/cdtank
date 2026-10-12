# 原表情选择与Web聊天业务（M5-12-E/E-B）

原限定证据见chat-emote-source.md：三十按钮插入U+2581–259E，手动/01–/30全串转换，原font注册三十base图片；原发送4119b0特殊双字节A262–A27F，接收41242a生成emote图文标签。标签是显示层，不是发送线上字符串。未知/00、/31等不转换；/010前缀/01转换而末0保留。

正式SourceChatEmotes复用game_main_chat_shrinked的btnExpandEmotion原三图与game_main_emotelist原32控件几何/九切片。当前SourceBattleChat只在战斗/结束阶段启用，选择在原生input.selectionStart插一个glyph，正常Enter与F5仍由唯一BattleChat发送链确认。组合输入中不转换typed别名，compositionend后恢复。表情按钮pointerdown记录本次组合状态并阻止焦点转移，后续click不受blur触发compositionend清标记的影响；候选提交后正常点击恢复。实际浏览器发现仅click时检查composing会被原生blur提前结束绕过，已按上述目标处理修复并复验。展开只确保打开，重复点击保持打开；选中后保留列表并恢复输入焦点，按chat-emote-source原回调，不再使用初次Web切换/选后关闭。离场/阶段切换/频道列表打开清理表情列表，待确认期间源按钮及全部项禁选择。

chat-emote-text唯一glyph/alias转换规则属于客户端；ChatEmotes加载原三十base图后将收到Unicode内部glyph显示为纯DOM图片，其余文字使用text节点，字面HTML/未知token不解释。已有日志在资源就绪后重绘，不因source加载丢失消息。无innerHTML、无自定义emoji、无协议sender字段扩充。

TSRPC沿既有Unicode文本传递glyph，服务器72码元校验/同房与同队权威路由未改；此为明确重建运输，不声称发原A262包。原native输入继续显示Unicode符号，列表及消息展示原base图片；CEGUI动态图片字体/收到tag解析/动画帧定时未恢复，不能宣称输入像素或完整动画等价。选择达到72时拒绝且保留草稿，typed转换后caret按转换前缀长度定位，两者为明确Web适配；原CEGUI setText满长处置与光标钳制留E父项。

本轮E-B验收普通页面两账户进入真实战斗、源选择/typed中文及多表情混合→唯一真实RoomChat→相同原图日志、公共/队伍与个人拒绝草稿、71/72边界与组合隔离、退出WAITING清理、全30PNG/源矩形/按钮态/九切片及1080p4K。相关命令test:chat:emotes与:browser、全仓类型/正式依赖/Web发行；服务器/账户/CPU/资产生产未改，复用保存/两局/原资源基线。

原动画下一接线依据chat-emote-render-source.md，全部30默认seqimage/72帧已由export_chat_emote_sequences.py导出；现正式收到消息已按原默认seqimage播放，base图仅为资源失败时回退，详细时钟/去重/清理边界见chat-emote-animation-runtime.md；M5-12-E-A状态与真实动画证据以tasklist为准。
