# 服务重启与账户状态

M7-07 已确认 SQLite 账户恢复与临时房间策略。普通玩家用同一浏览器凭据重新认证，读取已确认的拥有角色、装备配置、库存、交易确认和历史。活跃比赛及房间不保存；未完成局不生成历史记录，玩家从大厅重新入场。

## 已有有效证据

| 数据范围 | 实际证据 | 取得方式与边界 |
| --- | --- | --- |
| 身份、昵称、库存、七槽、购入角色与资料、好友、购买回执 | `account-backup-restore-accepted.json` | 普通 API 购买/配置后在线备份、恢复库编译服务冷启动；资金-only 建档夹具明确，重复 requestId 不扣不增 |
| 战车与宠物选择 | `tank-purchase-accepted.json`、`pet-purchase-accepted.json`、`pet-paid-accepted.json` | 原有真实购买、选用、同库重启范围复用，初值和购买授权为明确重建 |
| 装备五槽与库存标记 | `react-equipment-2026-10-03T15-37-27-485Z.json` | 普通 React 装配/移动/卸载后真实服务重启；原拥有记录和库存夹具明确 |
| 战车纹理与价格确认 | `tank-texture-network.json` | 实际确认、扣款、拒绝和重启恢复；原拥有记录夹具明确 |
| 黑名单 | `blacklist-network.json` | 实际账户 API 增删、拒绝、隔离与服务重启，原 profile/friends 不变 |
| 历史 | `account-history-network.json`、`account-backup-history-restore-2026-10-04T22-24-35-543Z.json` | 原冻结结果双身份写入、重启分页与新服务房间 ID 复用隔离；已有正常两局库只读备份恢复 |

## 活跃比赛中断

`browser-active-room-restart-2026-10-04T22-57-56-108Z.json` 中有效范围：复制合法已购角色检查点，通过真实 Shop 购买 17031 并在 Home 装到槽0，双普通账户正常创建、加入、Ready 进入 PLAYING，服务器确认 `queuedPartSkillIds=[13501]`。实际停止编译发行服务，两浏览器清除旧 world、对局页面和聊天。原库重新启动后，同凭据身份保留，Equipment/Inventory/OwnedRoles/History 全文与中断前一致，原临时房间不再存在、未完成局未加入 History。普通重新创建与加入、Ready 后仍有 13501 资格。

完整 PLAYING 和恢复后大厅 1920 图已主审。此段没有新增资金、库存或拥有角色导入，没有活跃位置、伤害、事件或结果注入；普通开局资源与原表现直接复用。验收索引 `active-room-restart-accepted.json` 保留原始整体状态并接受有效段。`browser-active-room-restart-2026-10-04T22-59-43-365Z.json` 的一次 leave-only 尾段通过正常 PLAYING→FINISHED 两端退出并回 enabled Create 焦点，未重复购买、重启或截图。

## 未完成范围

原经验、货币奖励和等级增长的权威写入规则尚缺来源；现历史得分不转换为成长。M6-02/M2-11 与 M7-07 完整父项保持未完成。原中断判负及原房间恢复规则也未恢复；当前不恢复临时房间属于明确重建策略。
