# 战车改装当前实现

M6-03 / UI-33。本文记录当前已集成的战车改装 Web 行为、公开接口、账户事务和边界，便于后续验收按同一当前状态复核。

## 公开接口

共享合同为 `apps/shared/protocols/PtlTankUpgrade.ts`，公开账户 API 为 `TankUpgrade`，操作只有 `QUERY` 与 `UPGRADE`。请求只包含 `operation`、owned `instanceId`、`action` 与当前请求幂等键 `requestId`；服务端返回 `owned`、当前 `profile`、quote 列表，以及新提交或 replay 时的 confirmation 信息。`serviceProto.ts` 保留既有服务 ID、字段和版本增量，手工追加 TankUpgrade API 与 schema；没有运行协议生成器。

## 当前事务行为

`AccountStore.tankUpgrade(accountId, request)` 委托 `AccountTankUpgrade`。QUERY 只校验账户并读取当前 owned、profile 与每个 owned tank 的 action1/action2 quote。UPGRADE 要求登录，允许无房间或 `WAITING`，在 `BEGIN IMMEDIATE` 中校验 owned instance、action、资格位、目标 TankUp 行、费用和余额，失败整体回滚。

原 source 费用为 owned `+24` 对应 Tank 表 `TankMoney` 与目标 TankUp 行 `花費金錢` 的 uint32 低乘积再无符号整除 100；`花費創意點數` 直接进入 originality 费用。等级域采用 0..24，目标行为 1..25；25 为终表哨兵，当前 24 及以上拒绝，最高可执行 23→24，失败等级下限为 0。成功/失败/无效果按表字面值采用 100 点整数优先采样：先 Success 段、再 Fail 剩余段、其余 noEffect。成功与失败按 action 对应 Tank 表 Min/Max 无符号增减，属性与加成 clamp 到 0..0xffff，noEffect 保留当前值。以上采样、Min/Max 与购买资格 producer 是 Web 采用规则，不是原服务器结果公式恢复。

成功提交只更新当前账户的一个 owned equipment 记录和 profile money/originality，并保留纹理、部件、期限、状态及其它 receipt。`tank_upgrade_receipts` 与 `account_spending_ledger source='tank-upgrade'` 在同一事务写入。相同账户、requestId、action、instanceId 的重入返回 `historicalConfirmation` 与 `replayed:true`，响应中的 owned/profile 来自当前持久状态；历史 confirmation 不重扣、不重 roll、不回拨钱包或属性。同 requestId 用于不同 action/instance 时拒绝冲突。

## 房间与消费者

QUERY 无房间及所有阶段均可只读使用。UPGRADE 无房间或 WAITING 可提交；LOADING、PLAYING、FINISHED 在账户事务前拒绝。新提交在 WAITING 成功后重绑 inventory、角色来源和 equipment profile，取消该玩家 Ready 并广播房间状态；replay 不重复取消 Ready。

更新后的 owned `+3c/+40` 或 `+4c/+50`、`+44/+54` 经 `AccountStore.roleRecords`、`AccountStore.selectedRoleSources`、`World.bindRoleSources` 进入既有角色重算；profile money/originality 经 `World.bindEquipmentProfile` 成为当前装备资料。正常 `TankShop BUY` 仅在新 owned equipment 写入 `+38=1/+48=1`，已有或导入记录的 0 资格不自动迁移。

## UI 消费者

Home `btnModifyFire`/`btnModifyPanzer` 保留 `tankeshengjiqu` 父几何、源按钮图和 `txtAttackLevel`/`txtPanzerLevel` 相对坐标；old owned `+38/+48=0` 保持禁用，新购 producer 写 1 后开放。`HomeTankUpgradeDialog` 消费 `myhome_panzerpage_modify.xml` 24 控件，按服务端 quote 显示等级、费用、成功/失败/noEffect 字面、当前 owned 属性与下一等级候选边界。确认按钮只提交 instance/action/requestId；资源准备失败保留原弹窗、错误和局部 retry/focus，资源 retry 不发送 UPGRADE，也不改变 attempt/requestId。replayed 响应只把历史 confirmation 转成结果文字，当前 owned/profile 始终覆盖页面 state。

## 未实测边界

当前未实测真实网页、协议消费者、账户事务、普通自然伤害消费者、双端、同库持久重启、HD/1:1、原完整 Home 93 控件与 UI-33 页面验收。原服务器结果采样、attribute/bonus producer、owned `+38/+48` 原始 producer 与购入建档仍未取得；M6-03、UI-33、M2-01、M6-06、M5-07 及其它完整父项保持未勾。
