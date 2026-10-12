# 黑名单浏览器业务验收

正式三账户页面通过黑名单业务范围验收，接受索引为 `recovery/output/browser-blacklist-accepted.json`。有效证据由大厅前段、WAITING/重启 PASS 与 PLAYING PASS 组成，原始 FAIL 全部保留。

`tests/browser-blacklist.mjs` 使用实际 index 服务器 3210、Vite 5370、Chrome CDP 9570，三个独立浏览器上下文通过普通认证、昵称、源资料按钮和真实鼠标键盘执行。观察真实 WebSocket 请求、拒绝响应与消息投递，无页面或服务器状态注入。

| 有效范围 | 证据 |
| --- | --- |
| 乙源 AddBlacklist 转 RemoveBlacklist，权威记录确认 | 三份范围证据均覆盖 |
| 甲大厅 Enter 密语拒绝，草稿保留，全部页面无密语投递；乙源解除后成功且第三页不收 | `browser-blacklist-2026-10-04T07-55-49-*.json` 的三个有效检查 |
| 普通建房 WAITING，私聊频道 Enter 被屏蔽保草稿无投递；正常离开后乙源解除，重新普通建房密语恢复 | `browser-blacklist-2026-10-04T07-58-06-586Z.json` PASS |
| 实际停止服务器并重启同 SQLite，页面刷新同账户认证，乙资料恢复 RemoveBlacklist；甲密语再次拒绝，解除成功 | 同 WAITING/重启 PASS |
| 乙源 AddFriend 准备 FriendTab 访问；甲正常添加两个 CPU、源 Ready 进入 PLAYING，源 Private 频道 Enter 拒绝保草稿无投递 | `browser-blacklist-2026-10-04T07-58-50-362Z.json` PASS |
| 乙普通 FriendTab 打开甲资料，源 RemoveBlacklist 解除，甲战斗密语成功跨大厅投递，第三页不收 | 同 PLAYING PASS |

PLAYING 证据中 `playingBeforeBlock.phase` 与 `phaseAfterUnblock` 都为 `PLAYING`。该模式读取资源就绪并等待源 Ready 可用；Babylon 三维光栅缩放为 8 降低测试渲染成本，界面坐标和游戏规则保持实际路径。未作高清性能等价声明。

网络测试另覆盖正常 Ready 后 PLAYING、3 秒自然截止 FINISHED 的拒绝与无投递，阶段样本保存在 `blacklist-network.json` 的 `evidence.naturalPhases`。重复增删、离线添加、自己/不存在拒绝、多连接与双方屏蔽方向、账户隔离、原资料和好友关系保持由该真实网络证据覆盖。源界面三分辨率精度使用独立源界面验收。

脚本完整模式包含大厅、WAITING 与重启范围；`--lifecycle-only` 仅准备黑名单并续 WAITING/重启；`--playing-only` 仅普通关系准备与 PLAYING 屏蔽/解除。

## 已知边界

接受结果为范围组合，未声称单次完整运行全 PASS。原服务端过滤规则未知；当前接收方权威屏蔽两种密语的行为明确重建，原静态来源与边界见 `blacklist-server.md`。公开与队伍聊天保持已有行为。

## 清理

测试关闭全部页面、上下文、Vite、服务器和 Chrome，移除临时 SQLite 与浏览器目录。交付时 3209、3210、5370、9570 无监听进程。
