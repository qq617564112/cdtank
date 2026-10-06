# 1UP 普通双端网页验收

本项实际验收 PASS：双方 tick66 的团队存量从 `[30,30]` 变为 `[31,30]`，双方各记录 3 次实际几何绘制回调，SE13 均正常播放并自然结束。重复键只发送一次 `useItem:5`，重启恢复与 mode4 正常拒绝均通过。

`npm run test:combat:team-life:browser` 使用两个独立 Chromium 窗口中的账户页面，均为 1920×1080、deviceScaleFactor 1、Babylon hardware scaling 1。专用服务 3183、Vite 5220、Chrome CDP 9290 使用临时数据库与浏览器 profile；结束时停止专用进程并删除临时目录。

开局前通过 AccountStore 将已有账户的物品 501 库存置为 3。在正常“我的家”物品列表选择该实例并配置背包 slot4，随后通过普通鼠标与键盘选择 mode1/map7、CreateRoom、Join、Ready、Digit5。资源加载与双方模型动作实际就绪后才 Ready。验收没有修改战中位置、HP、存量、库存或服务器时间。

双方完整 WebSocket `itemUsed` 均携带 skill501、value1、本人 targetId 与源第一槽 `PlaySkillEffect` 通知。双方相同 tick 的团队存量仅本队增加 1，对队保持不变；正常 Inventory 查询核对 ownedQuantity 3→2、battleQuantity 2→1。按住快捷键期间五个自动重复 keyDown 不产生第二次消费。

双方只读观察源 Effect12 的 11 节点、8 个几何 draw 节点、活 `tag_efcenter` 父矩阵引用以及实际场景 mesh `onAfterRender` 回调。源独立 SE13.wav 在双方触发 `playing`、自然 `ended`，随后声音 voices 清零，单次特效自然清理。退出房间后双方特效实例与声音资源均为零。

真正停止并重新启动服务后重新加载页面，同一持久账户在我的家恢复库存 2 与 slot4。再通过普通 mode4/map7 双人房间与 Ready、Digit5 验证服务器拒绝使用：双方收到 `itemRejected`，源 HUD `edtBattleInfo` 显示“1UP仅可在团队模式使用”，ownedQuantity 与 battleQuantity 均保持 2，没有 `itemUsed`、特效或声音。

源参数来自 `recovery/output/web-assets/combat-catalog.json`：Skill501 Target1、TriggerType1、FuncType18 x1/y1、Effect12/SE13/Tag0。仅 mode1 的自身使用资格、持久库存事务消费及本队存量增加为重建规则。

## 证据

- `recovery/output/browser-team-life.json`：完整双端网络流、同 tick 快照、真实 draw/audio 观察、消费与拒绝库存、重启与进程清理。
- `recovery/output/browser-team-life.log`：专用服务完整日志。
- `recovery/output/browser-team-life-home-before.png`、`browser-team-life-active-1.png`、`browser-team-life-active-2.png`、`browser-team-life-restart-home.png`、`browser-team-life-mode-rejected.png`：1080p 页面截图。

## 限制

Effect12 内置 Type4 的 ww051 资源在已拥有源文件中缺失，沿用现有静默合同。独立 SE13.wav 的双端播放与自然结束已验证。单次特效遵循源生命周期，使用后截图可能晚于特效结束；实际绘制由场景回调记录。
