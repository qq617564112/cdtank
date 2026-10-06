# React 首片主线浏览器验收

运行入口：

```sh
node tests/browser-react-match-flow.mjs
```

`--ui-only` 串行运行创建房间、房间卡片、等待房间、地图选择和邀请五个原有浏览器 fixture；`--healing-only` 运行一次 `browser-healing-item.mjs --hd --reentry`；`--disconnect-only` 运行独立断线恢复检查。`--reentry-only` 配合 `CDTANK_REACT_CONTINUATION_EVIDENCE` 读取已有两局证据中的真实余量，作为显式恢复的账户夹具输入，单独运行账户保存、真实服务重启及最终重入消耗。`--from=<fixture名>` 从指定项继续。组合入口保留原有断言和完整 stdout/stderr，并将本次新生成的 JSON、服务日志和截图复制到 `recovery/output/react-match-<UTC时间>-*`。汇总 JSON 只记录实际执行的子集；任一 fixture 失败即停止。

大厅创建和房间列表、等待房间准备、结算再战的生产入口为 `main.ts → App → LobbyView / BattleMatchView`。`LobbyView` 渲染 `RoomCards`、`RoomCreateDialog`；`BattleMatchView` 渲染 `WaitingRoomView` 和结算按钮。这些 TSX 视图通过 React 事件和外部状态订阅驱动真实 `Battle` / 网络业务。场景由 `createSceneRuntime` 初始化；页面仅建立一个 React root。验收使用正常网页及服务端，不是独立组件测试。

覆盖范围：

- 创建窗口：原始 PNG、几何位置、原生鼠键、草稿取消、人数限制、友军伤害、服务拒绝与正常创建/密码加入，1080p / 4K。
- 房间卡片：真实目录状态、选中、分页、刷新、密码拒绝、普通 Join，1080p / 4K。
- 等待房间：两页真实成员状态、准备/取消、队伍确认、请求 pending、输入隔离、原生焦点、自然 PLAYING 和退出，1080p / 4K。
- 地图选择：原始五模式、八格布局、真实目录、原生草稿/取消/确认/焦点、服务器拒绝和进入 WAITING，1080p / 4K。
- 邀请：真实大厅接收、冷却、原始 source 控件、密码拒绝/保留/焦点、正常密码加入、无接收者提示和退出，1080p / 4K。
- 对局：两页正常库存配置、创建/加入、CPU 自然伤害与两局自然结束、普通 ArrowRight 炮塔朝向将使用者纳入访客相机视锥后，普通 Digit5 消耗、Effect11 实际 draw、GA15 双端实际播放、双人再战、退出清理、服务重启后余量及快捷键保留、重新进入与最后消耗，1080p。
- 断线恢复：正常创建并载入 WAITING 房间后真实关闭服务，验证世界状态、玩家、地图、弹丸、效果、声音、输入和房间消息状态清空，React 对局视图消失且返回按钮可用；正常返回、服务重启、重新创建 WAITING、退出。通过 React props 取得实际 Battle 对象只读观测，不注入状态。

每个 UI fixture 使用其原有独立服务、Vite 和 Chrome 端口；综合对局使用服务 3138、Vite 5193、专属 Chrome CDP 9361；断线检查使用 3212 / 5244 / 9362，串行执行。fixture 完成后清理临时账号库、页面和服务；组合入口额外关闭专属 Chrome 并删除其临时 profile。

## 限制

对局只运行普通小饲料手动控制主线；不覆盖大饲料、自动驾驶、独占角色纹理和原始移动变体。4K 覆盖五个 UI fixture，综合对局为 1080p 代表地图；不构成全部地图或全部内容性能证明。恢复的 Effect11 / GA15 来自原始资源，对局和 CPU 策略使用当前重建规则。断线检查在 WAITING 状态触发，活动战斗效果的正常退出清理由综合对局验证。

## 已通过的证据

| 范围 | 汇总运行 | 原始结果 |
| --- | --- | --- |
| 创建窗口、房间卡片 | `react-match-2026-10-03T14-14-59-908Z.json` | `-create-dialog.json` / `-room-cards.json` 为 PASS |
| 等待房间、地图选择 | `react-match-2026-10-03T14-17-54-824Z.json` | `-waiting-room.json` / `-map-selector.json` 为 PASS |
| 房间邀请 | `react-match-2026-10-03T14-21-54-772Z.json` | `-room-invitations.json` 为 PASS |
| 两个自然局、再战、两次双端效果/声音、量 3→1、首次重启保留 | `react-match-2026-10-03T14-41-23-435Z.json` | `-healing-reentry.json` 中两局与首次重启业务断言已通过；该运行总状态为 FAIL |
| 恢复真实余量夹具、再次服务重启、重入与最终量 1→0 持久化 | `react-match-2026-10-03T14-49-47-340Z.json` | `-healing-continuation.json` 为 PASS |
| 断线清理、正常返回与重入 | `react-match-2026-10-03T14-40-34-476Z.json` | `-disconnect.json` 为 PASS |

文件均位于 `recovery/output/`，对应 `-<fixture名>.log` 保留完整原始输出。前两份汇总运行因后续项失败显示 FAIL；表中列出的单项原始结果为已通过项，后续项各自独立复验。两局运行保存完整真实结算、再战、消耗和首次重启结果；其重入相机观察引用缺失导致总状态 FAIL，该状态保留。续段从该记录的量 1 / instance 77 / slot 4 显式恢复新的账户夹具，单独通过真实服务重启、正常双页重新进入、最后消费和量 0 重启持久化；它不声称复用了上一次运行的数据库，也不声称运行两局。

专属验收端口 3138 / 5193 / 9361 与 3212 / 5244 / 9362 均已关闭，专属 Chrome profile 和 healing/disconnect 临时账户目录均已删除。
