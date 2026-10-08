# 任务清单实现闭环登记

按功能组登记 ID 覆盖、生产入口与关键专题依据。完成以业务消费者／入口是否接入正式生产代码为准；原来源穷尽、原端实际页面／联机、持久化与高清验收集中登记在末尾“已知限制”，不阻止完成标记，也不替代已发生的真实证据。

## 覆盖登记

| 功能组 | 覆盖 ID | 生产入口 | 关键专题依据 |
| --- | --- | --- | --- |
| 工程结构 | E-01…E-06、E-R01…E-R05（含 E-R02-I/E、E-R04-C/S、E-R05-H/N） | React 单 SPA 大厅→房间→战斗主线、`GameConnection`/`RoomFeed`/`Battle` | react-match-browser.md、react-home-inventory.md、react-home-equipment.md、react-lobby-chat-settings.md |
| 对局基线 | M0-01…M0-07 | World 房间生命周期、CPU 托管、结算冻结与再战 | battle-remaining-integration.md、cpu-all-maps.md |
| 账户与首件道具 | M1-01…M1-13（含 -B/-L 子项） | AccountStore、PtlInventory/PtlItem、World 施放与消费 CAS | healing-item-runtime.md、account-autopilot.md、cpu-loadout-accepted 索引 |
| 原规则与五模式 | M2-01…M2-13、M2-CAM、M2-03-OBB-SOURCE | `battle/roles`、`battle/items`、`battle/rooms`、五模式目标／时限／结算 | combat-field-inventory.md、client-communication-business-rules.md、cpu-all-maps.md |
| 资产与场景 | M3-01…M3-12（含 M3-03/04/05/06/07/08 各子项） | 资源 VFS/转换/发布、ScenePreview、SceneTerrainMaterial、动态物件与导航 | asset-usage-index.md、scene-metadata-loading-index.md、scene-breach-catalog.md、extended-scene-*-runtime.md |
| 技能与特效 | M4-01…M4-11、FUNC-01…FUNC-23（含 M4-10 逐内容子项） | `battle/reachable-executors`、`battle/skills`、`render/effects`、宠物事件消费者 | battle-reachable-executors.md、skill-function-coverage.md、skill-function-1-2-production-source.md、各 FUNC 专题 |
| 原界面与玩家流程 | M5-01…M5-16（含各 -R/-C/专题子项） | `interface/login`、`interface/lobby`、`interface/home`、`interface/account`、`interface/dialogs` | waiting-room-page-*.md、react-*.md、home-*-runtime/presentation 专题、home-tank-page-state-runtime.md |
| 装备、成长、商城与社会 | M6-01…M6-10（含各子项） | AccountStore 归属／成长、PtlEquipment/PtlTankUpgrade、Shop BUY、交易、聊天、好友、GM | account-inventory.md、shop-owned-role-parameters-source.md、trade-detail-fields-implementation.md、family-chat-runtime.md、gm-support-replies-runtime.md |
| 高清、性能与联机 | M7-01…M7-08 | 页面缩放、服务端 tick、快照/插值、重连清理、重启持久、连续对局清理 | react-*hd/runtime 专题、server-tick-*.json、browser-active-room-restart 专题 |
| 部署与交付 | M8-01…M8-05 | `build:web`/`build:server`/`start:server`、`scripts/package-release.mjs`、`scripts/account-snapshot.mjs` | deployment 入口、README 运行说明、complete-content-audit-scope.md |
| 65 原布局 | UI-01…UI-65 | `interface/*` 对应原布局消费组件 | 各 UI 专题与 accepted/review json、home-tank-page-state-runtime.md |
| 26 原模式地图组合 | MAP-1-0002…MAP-5-0022 | 五模式 selector/房间入口、`m001`–`m005` 表 | cpu-all-maps.md、各地图专题 |
| 扩展 12 图 54 支持组合 | MAP-EXT-1/2/3/4/5-0001/0003/0008/0009/0012/0013/0015/0016/0019/0023/0024/0025 | 正式地图目录与房间入口、scene-castle-0023、Plant/Castle/C9 接线 | extra-map-mode-support.md、extended-scene-*-runtime.md |

## 实现缺口

无。全部功能项均已有正式生产消费者／入口。

`M5-07`／`UI-32` Home 战车与装备共用页整页状态组已完成：共享模块 `apps/web/src/interface/home/home-tank-page-state.tsx` 提供 `homeTankListQuantity`（活动名单 `${rows}/20`）、`HomeTankUpgradeEntries`（两模式常显 `btnModifyFire`/`btnModifyPanzer` 与子 level）、`HomeTankUseControl`（`btnUse`/`picAlreadyUsed` 互斥）；战车模式经 `home-roles.tsx`、装备模式经 `home-equipment.tsx` 消费，确认复用现 `TankUpgrade` 与 `selectRole` 事务，无新增协议。`txtTankStatus` 原控件无 producer、保持空串，不是缺口。详见 `home-tank-page-state-runtime.md` 与 `home-tank-page-state-source.md`。依赖其范围关闭的 `M5-16` 一并完成。

## 已知限制

以下范围只缺原始来源、原端实际页面／联机、持久化或高清／性能验收，生产业务消费者／入口已接，不阻止完成标记，不伪造实测：

- 原服务端完整公式、原 callback／混合与不可达旧入口：`client-communication-business-rules.md`、`battle-remaining-integration.md` 来源边界。
- 原设备／D3D 像素、原 GPU 采样与未取得的原声音／字体内容：各 `scene-*-source`、`effect-*-source` 专题。
- 资产索引未关联原路径与 textureIssues：`asset-usage-index.md`。
- 逐资源实载、逐布局像素、双端／高清与性能实测：`battle-production-closure.md` 来源与验收边界、各 UI/地图专题。
- Home 战车／装备整页：原 `txtOriginality`/`txtListQuantity` 动态 producer、升级 `+0x38`/`+0x48` 原始 producer、高清字距与全 93 控件 1:1 未恢复；`txtTankStatus` 原为空按原样保留。见 `home-tank-page-state-runtime.md`、`home-tank-page-state-source.md`。
