# 好友浏览器业务验收

正式 React 页面通过好友业务验收。证据组合为 `recovery/output/browser-friends-accepted.json`：一个原始完整运行的有效前段与一个生命周期运行 PASS，全部原始 FAIL 文件保留。

`tests/browser-friends.mjs` 启动实际 index 服务器 3208、Vite 5368 和 Chrome CDP 9568。三个独立浏览器上下文通过普通账户流程建立身份与昵称，使用真实鼠标、键盘输入；读取真实 WebSocket 帧核对 RPC 和密语目标。页面状态与服务器状态未注入。

| 有效范围 | 证据 |
| --- | --- |
| 源资料 Add 按钮转为 Remove，普通 FriendTab 显示唯一权威好友行并刷新 | `browser-friends-2026-10-04T07-40-09-433Z.json` 的前五检查；生命周期运行亦覆盖 Add |
| 目标与第三账户的 FriendTab 均为空，关系单向隔离 | 同前段证据 |
| Shift+F10 打开自己的资料，普通 Add 拒绝并保留现有关系 | 同前段证据 |
| 好友行 Enter 选择密语目标，按目标 accountId 发给乙，第三页收不到 | 同前段证据 |
| 乙普通源建房流程使甲的好友显示对局中 | 两份证据均覆盖 |
| 等待 Close 可用且真实鼠标命中，正常 Leave 发出并成功，好友返回在线 | `browser-friends-2026-10-04T07-45-36-183Z.json` |
| 乙页面离开至 about:blank，甲保留离线好友；离线资料仍显示 Remove | 同生命周期 PASS |
| 甲真实刷新恢复同账户关系 | 同生命周期 PASS |
| 实际停止服务器，好友列表清空、当前资料关闭 | 同生命周期 PASS |
| 实际重启同一 SQLite 服务器后刷新认证，单向关系恢复 | 同生命周期 PASS |
| Shift+F10 资料中的源 Remove 删除，按钮变为 Add，名单为空；刷新后仍为空 | 同生命周期 PASS |

生命周期 PASS 含 9 项检查。源 Close 的真实命中记录与 `Leave` 请求/成功响应保存在同份 JSON。最终页面截图为 `recovery/output/browser-friends-2026-10-04T07-45-36-183Z-final.png`。

`--lifecycle-only` 通过普通 Add 准备关系，接续入房、离开、断线、刷新、服务器关启与删除。完整模式另外覆盖单向隔离、自身拒绝与好友名单密语。

重复 ADD、删除已不存在关系、未知账户拒绝、多连接状态与原账户资料未改由实际网络验收 `friends-network.json` 覆盖。源页面三分辨率精度采用独立源界面验收，本脚本集中验证业务。

## 已知边界

接受结果为范围组合，未宣称单次完整运行全 PASS。原服务端好友批准规则与原客户端两个容器总量 64 的身份含义未恢复，详见 `friends-server.md`。原始失败证据保存在 accepted JSON 的 `rawFailuresRetained` 中。

## 清理

测试关闭全部页面和浏览器上下文、Vite、服务器与 Chrome，并移除临时数据库与浏览器目录。交付时 3207、3208、5368、9568 无监听进程。
