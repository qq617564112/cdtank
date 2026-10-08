# 我的家战车/装备整页状态运行接线

范围：M5-07 / UI-32，原 `myhome_panzerpage.xml` 共用页的 `rdoTank` 战车模式与 `rdoEquip`
装备模式整页状态组。原来源事实与采用合同见
[home-tank-page-state-source.md](home-tank-page-state-source.md)。

## 正式组件与入口

共享状态组抽取到 `apps/web/src/interface/home/home-tank-page-state.tsx`，由两模式共同消费：

- `homeTankListQuantity(rows)`：按 `sprintf_s("%d/%d", rows, 0x14)` 输出 `${rows}/20`，
  `HOME_TANK_LIST_CAPACITY` 为 `20`。
- `HomeTankUpgradeEntries`：原 `tankeshengjiqu` 常显子控件 `btnModifyFire`/`btnModifyPanzer`
  及子等级 `txtAttackLevel`/`txtPanzerLevel`。
- `HomeTankUseControl`：原 `btnUse`/`picAlreadyUsed` 互斥对。

战车模式经 `apps/web/src/interface/home/home-roles.tsx` 的 `HomeTankSourcePage` 消费，
装备模式经 `apps/web/src/interface/home/home-equipment.tsx` 的 `EquipmentSession` 消费。
两模式共用 `HomeTankSourceRegions`、`HomeTankDescription`、`HomeTankOwnedAttributes`、
`HomeTankOwnedParameters` 与 `HomeTankUpgradeDialog`。

## 状态与事务

| 组 | 战车模式 | 装备模式 |
| --- | --- | --- |
| `txtListQuantity` | `quantity={owned.equipment.length}` → `${rows}/20` | 当前 Common/Hat/Mark 分类已确认 `records.length` → `${rows}/20` |
| `txtMoney`/`txtOriginality` | 角色 Profile `+0x70` 与 `growth.originality ?? playerSummary.originality` | Equipment QUERY profile `+0x70` 与 RoleProfile 创意点 |
| 改装入口与等级 | `HomeTankUpgradeEntries`，等级取 `+0x44`/`+0x54` | 同一 `HomeTankUpgradeEntries`，记录取当前匹配 owned 战车 |
| `btnUse`/`picAlreadyUsed` | `displayed === currentId` 显示当前标记，否则可用 Use | `equipment.tankInstanceId === currentTankInstanceId` 时显示当前标记 |
| `txtTankStatus` | 保持原空字符串 | 保持原空字符串 |

改装确认复用现 `HomeTankUpgradeDialog` 与 `PtlTankUpgrade` 的 `QUERY`/`UPGRADE`，无新增协议、
钱包、授权或持久交易。装备模式开放资格取已确认 owned `+0x38`（火力）/`+0x48`（装甲）
与 QUERY quote；`+0x38`/`+0x48` 为 `0` 保持源禁用，不自动开放。原 `source` 门禁只是
`tankup` 下一等级记录存在，与现采用资格不是同一来源，二者分别登记。

`useTarget` 复用现 `selectRole({kind:'tank', instanceId})` 确认事务提交当前显示实例，
不新增交易。`refreshTarget` 以 `session.current.active` 与 Equipment `tankInstanceId`
严格校验目标，旧 target/账号/会话的迟到响应不回挂。

## 刷新、pending 与焦点

- 打开装备页并行首查 `Equipment {operation:'QUERY', tankInstanceId}`、`Inventory`、
  `OwnedRoles`、`RoleProfile`；`tankInstanceId` 与确认目标不一致时抛确认不一致错误，
  不当作空数据。
- 升级确认 `onState` 以 `result.owned` 覆盖 owned，再走 `refreshTarget` 重查
  Equipment 与 RoleProfile 刷新余额、创意点与目标投影。
- 装载/卸下保存以 `session.current.pending` 串行化，先服务端 CAS 确认再更新确认投影，
  失败保确认值并提示，不乐观写入。
- 子 modal 由 `HomeTankUpgradeDialog` 经 body 级 portal 打开，`SourceNoticeView` 同样 portal；
  Escape 在对话框层拦截，未提交的 Escape 不产生额外事务；关闭后焦点回到原入口。
- 账户或连接世代变化重置会话并从当前确认资料重建，迟到响应按 `session.current.active` 丢弃。

## 保持原空/原禁用

- `txtTankStatus`(+0x8c)：原页面类只有构造存储与基类清零，整页 update/selection/模式切换
  无 `setText`/门禁/文字键，XML 初值为空。两模式保持空即与原控件一致，不列实现缺口。
- `btnModifyFire`/`btnModifyPanzer`：原页面无显示/隐藏/禁用 setter，两模式常显；现资格取
  `+0x38`/`+0x48`，`0` 时保持源禁用。
- `btnUse`：原 `DisabledImage` 缺失，禁用态不画按钮图；当前出击实例下以 `picAlreadyUsed`
  覆盖同矩形，为既有已接受表示。

## 边界

运行时状态、pending/代际隔离与刷新链已接入正式生产入口。原 `txtOriginality`/
`txtListQuantity` 动态 producer、升级 `+0x38`/`+0x48` 原始 producer、高清字距与全 93
控件 1:1 未恢复，属原来源/高清已知限制，不作为现功能完成门禁。实际网页、双端、持久化、
高清未在本片执行。
