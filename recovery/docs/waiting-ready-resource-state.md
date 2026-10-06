# 等待房间准备资源资格

正式等待房间的准备按钮消费 Battle 已有的资源门禁：地图完成载入、当前快照中的全部角色资源就绪、没有角色资源载入错误。资源尚未就绪时，准备按钮禁用；载入完成后自动恢复。退出、邀请和房间管理仍各自使用现有请求资格。

Battle 在接收快照时先更新角色资源名单，再同步准备资格；渲染回调同步异步资源完成状态。BattleMatch 只在资格变化时发布状态，保持原 pending、错误和请求代号所有权。离房 clear 清除资格，下一房重新确认。WaitingRoomView 只消费 readyAvailable，服务端 Ready 和 Battle.ready 的原校验保持有效。

这是 Web 资源与现业务入口的接线规则，不推定原客户端准备按钮的回调或原服务器开局权限。资源错误仍由已有 HUD 呈现，载入期间可以正常退出。

`tests/waiting-ready-resource.cts` 验证资源未完成时不提交准备、资源完成恢复、相同资格不重复发布、异步变化保留 pending、载入期间允许退出、clear 不保留上房资格。`tests/react-match-store.cts` 验证现准备请求拒绝、旧请求取消、冻结结果和再战语义。证据为 waiting-ready-resource-module.log、waiting-ready-match-store.log 和 waiting-ready-resource-types-final.log。

自然死亡 Countdown 的实际图字与权威复活取消仍需玩家证据。资源资格模块检查不证明自然死亡或原复活时间。

普通玩家证据为 browser-death-countdown-2026-10-04T18-34-24-960Z.json：两次严格命中的添加 CPU 请求成功，资源完成后两端正常准备进入 PLAYING，P2 自然死亡显示原5/4并在复活后取消，双端正常离房清空。本机自然死亡范围见 death-countdown-player-actual.json，原整体 INCOMPLETE 保留。最终统一 Web 类型与发行构建 ready-countdown-saved-history-final-web-build.log 通过（1m38）。
