# React 房间与对局聊天

对应 `E-R04-C`。房间消息、输入、频道、发送状态以及原对局菜单和滚动控件由 `BattleChatView` 渲染，正式 `BattleChat` 为无 DOM 的语义状态控制器。

## 模块与状态

`battle-chat.ts` 保留 `show/clear/setPhase/message/setQuickChats` 业务调用；稳定 `getSnapshot/subscribe` 接入 `useSyncExternalStore`。只发布聊天状态，战斗 tick 不订阅界面。普通与快捷发送共享 pending 门禁，频道在发送期间保持锁定；确认不自行产生消息，只有服务端推送进入日志。日志保留最新 50 条及稳定消息编号。

每次 `clear` 增加房间代际并清除草稿、频道、日志和发送状态。旧请求确认或拒绝不能覆盖新房间状态或解锁其请求。普通成功确认仅清除仍与发送内容一致的草稿，失败保留草稿；快捷成功发送始终保留当前草稿。快捷配置经过现有校验并克隆保存。

`battle-chat-view.tsx` 在可见房间挂载独立会话，拥有输入、IME、caret、键盘监听和资源载入。Enter 打开输入；F5–F12 复用普通发送通道，空快捷与重复按键抑制浏览器默认行为。组合键、可编辑控件、打开的 dialog 和中文组合输入保持门禁。Escape 离开输入，频道焦点和编辑操作释放战斗按键。

`source-battle-chat.tsx`、`source-chat-emotes.tsx`、`source-chat-scrollbar.tsx` 为真正 JSX；`source-chat-layout.tsx` 从原导出资源生成位置和图片 props。原频道/表情菜单控件、静态 picker 图、按钮状态与九宫格保持原布局；频道数值仍采用已有房间/队伍重建规则。

原 `ChatEmotes` 仅管理 React 所拥有消息 li 的叶内容：富文本、来源图片、颜色和动画。整个会话共享同一 renderer，重复表情每帧只更新一个源 provider。li 移除时注销叶引用，最后一条移除停止动画；会话清理停止 RAF、ResizeObserver，迟到序列载入不重新发布资源。

## 原滚动与高清

消息列表使用真实浏览器文本尺寸和滚动范围；源滚动条的宽度、按钮尺寸、最小 thumb、每步 16px、RichEdit 新消息一页加一行行为保持现有规则。React 控件支持上下按钮、轨道翻页、拖动、滚轮及 Home/End/Arrow/Page 输入，控件事件隔离战斗快捷键。MutationObserver、ResizeObserver、图片 load 与原生 scroll 更新实际尺寸；离开源表现或房间全部解绑。

PLAYING 和 FINISHED 使用同一来源表现；相同模式不推送重复快照。源 stage 保持 800×600 基准缩放和下方聊天原位置，resize 经 React commit 更新适配 1080p/4K。WAITING 保留现有房间简化呈现。

## 验收

`npx tsx tests/quick-chat.cts` 验证真实控制器的确认/失败草稿、普通与快捷共享 pending、锁定频道、旧房间响应隔离、50 条权威消息、稳定快照和阶段切换。Web 类型检查通过。真实双端输入、中文、源菜单、动画、滚动及高清由 `E-R04-C` 浏览器验收记录提供；规则检查不代替玩家操作验收。
