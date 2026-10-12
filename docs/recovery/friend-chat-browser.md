# 好友频道浏览器验收

正式页面好友频道通过业务范围验收。`browser-friend-chat-accepted.json` 接受大厅前段 8 项有效检查与生命周期 PASS 7 项；全部原始 FAIL 保留。

`tests/browser-friend-chat.mjs` 启动实际 index 服务器 3212、Vite 5372 与 Chrome CDP 9572。三个独立浏览器上下文通过普通认证、昵称和源资料 AddFriend/AddBlacklist/RemoveBlacklist 建立关系，真实鼠标、键盘操作频道和输入，读取实际 WebSocket 帧核对收件连接。页面与服务器状态未注入。

| 范围 | 证据 |
| --- | --- |
| 无好友拒绝并保留草稿，无消息投递 | `browser-friend-chat-2026-10-04T08-07-08-414Z.json` 有效前段 |
| 甲单向添加乙，普通源好友频道仅甲乙收到，第三页不收；乙反向无好友拒绝 | 同前段 |
| 乙屏蔽甲后无有效收件人拒绝；甲再添加丙，仅甲丙收到；解除后甲乙丙各收一次 | 同前段 |
| 大厅 IME 候选 Enter 无发送，确认后普通好友输入成功 | 同前段 |
| 甲普通建房，WAITING 好友频道成功投递两位大厅好友 | `browser-friend-chat-2026-10-04T08-08-09-740Z.json` PASS |
| 正常两个 CPU、源 Ready，PLAYING 源 Friend 输入成功；候选 IME Enter 无发送 | 同生命周期 PASS |
| 15 秒自然 FINISHED，好友输入成功；正常 Rematch 后真实请求携当前 round2 成功 | 同生命周期 PASS |
| 普通 Leave 清旧房间草稿、日志并恢复大厅；实际断线清好友草稿和日志 | 同生命周期 PASS |

WAITING、PLAYING、FINISHED 请求源为 `R6/round1`，再战请求为 `R6/round2`，每次发送精确三个收到连接且包含发送方与两位好友。生命周期运行 `--lifecycle-only` 仅通过源 AddFriend 准备关系，再执行缺少的房间阶段与清理。

读取资源就绪用于正常 Ready 等待；Babylon 光栅缩放为 8 减少测试渲染成本，不作高清性能等价声明。源频道三分辨率几何采用独立源界面验收。多认证连接、跨大厅至不同房间、文字及身份拒绝、旧局拒绝由实际网络 `friend-chat-network.json` 覆盖。

## 已知边界

接受结果为有效范围组合，未宣称单次完整运行全 PASS。原好友频道 selector 数值 3 与原发送分支有来源；原服务端好友路由及原消息角色标记过滤的完整范围未恢复，当前路由明确重建。具体接口与边界见 `friend-chat-server.md`。

## 清理

测试关闭全部页面、浏览器上下文、Vite、服务器、Chrome，并移除临时数据库与浏览器目录。交付时 3211、3212、5372、9572 无监听进程。
