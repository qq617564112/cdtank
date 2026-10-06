# 邀请确认 Escape 松键准备

UI06 / M5-03。source-confirm-view.tsx 的 keydown Escape 在非组合时立即 requestCancel；RoomInvitations 忽略首消息后卸载 dialog，cleanup 恢复大厅原入口。SourceButton 对 Escape keyup 不阻止传播，LobbySourcePage 无 keyup 根隔离，因此窗口自己的 keyup handler 无法消费已转移到大厅的松键。

拟仅源确认模态记录非组合、非 pending 的 Escape keydown，在仍存在的 dialog keyup 消费后调用既有 requestCancel。native cancel、cleanup 原焦点、待确认/邀请队列、Join 与字体保现 owner。没有名单行处理或全局监听。归属已明确，production 已原子落实。

browser-invitation-confirm-escape-release.mjs 语法检查通过。专属两普通账户首次 keyboard-only：一次普通 Create/Invite 是原确认窗必要上下文，native Escape down 保窗口/焦点、up 忽略首邀请并严格回源 Create，window down/up=[]；房主普通 Leave。resolutions=[]/screenshots=[]，无 Join、Ready、购买、发送，旧密码/广播/三图证据复用。本次唯一实际已通过，证据与边界见 invitation-confirm-escape-release.md；Intimate 原加载缺口保持独立未关闭。
