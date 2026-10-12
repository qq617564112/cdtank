# 战车改装运行时

## 来源事实

原客户端入口为 `myhome_panzerpage.xml` 的 `btnModifyFire` / `btnModifyPanzer`，请求只携带 action 8 位和 owned instance 32 位。action1 使用 owned `+38` 资格位与 `+44` 等级，action2 使用 `+48` 资格位与 `+54` 等级。原 `49393e` 请求、`413cef` TankUp manager、`43b911` 表装载和 `3f94/3f95` 消息边界记录了这条客户端链路。

`Data/table/tankup.dat` 的已发布字段为 `等級`、`花費金錢`、`花費創意點數`、`失敗率`、`成功率`。费用使用 owned `+24` 对应 Tank 表 `TankMoney`：

```text
moneyCost = floor(uint32_low32(TankMoney * tankUpMoney) / 100)
originalityCost = tankUpOriginality
```

原 3f95 确认包为 action8、instance32、money32、originality16、attribute16、bonus16、result8。客户端在 profile 与 owned 实例均存在时先替换完整 money/originality，再按 result 写等级和两个属性。当前未恢复原服务器结果抽样、返回属性/加成生成公式和 owned 资格位的原始 producer，因此下列运行时规则属于 Web 采用政策。

## Web 采用政策

唯一公开账户接口为 `TankUpgrade`。QUERY 返回当前账户完整 `owned`、当前 `profile`、每个 owned tank 的 action1/action2 quote、资格状态、费用和成功/失败/无效果字面值。UPGRADE 接受 `action`、`instanceId`、`requestId`，在账户事务中完成校验、扣费、结果写入和 receipt 持久化。

结果域采用 100 点整数：

```text
roll = uniform integer [0, 99]
result = 0  if roll < Success
result = 2  else if roll < Success + Fail
result = 1  otherwise
```

成功使用 Tank 表 `Min/Max` 升级区间加法，`result=0` 并将等级加一；失败使用同一区间减法，下限为 0，`result=2` 并将等级减一；无效果返回当前 owned 属性/加成，`result=1`。返回的等级和两个属性均写入当前 equipped owned record 对应 action 字段；money 写 profile `0x70`，originality 写 profile `0x9c`。结果超过 0xffff 的 originality 余额拒绝事务。

等级采用当前域 0..24、目标行 1..25。25 为终表哨兵；当前等级 24 及以上返回 `UPGRADE_TARGET_UNAVAILABLE`，最高可执行升级为 23 到 24。owned `+38/+48` 为 0 时保持 source flag，QUERY 和 UPGRADE 都不自动改为 1。正常 `TankShop BUY` 新建档只在新 owned equipment 上写 `+38=1`、`+48=1`；已有记录、SELECT、交易、保养、迷彩和普通战斗不改写这两个资格位。

## 事务与房间

`AccountTankUpgrade` 使用现有 SQLite `BEGIN IMMEDIATE` 路径。事务内按账户、owned 实例、action、资格位、目标表行、费用和余额校验，扣减 money/originality，更新 action 对应的 level/attribute/bonus，写 `tank_upgrade_receipts`，并在同一事务向 `account_spending_ledger` 记 `source='tank-upgrade'` 的真实 money。事务失败整体回滚，不改变账户资料、owned record 或 receipt。

相同账户、requestId、action、instanceId 的重入读取历史 confirmation 并返回 `historicalConfirmation` 与 `replayed:true`；响应中的 `owned/profile/quotes` 来自当前持久状态，不重 roll、不重扣费、不覆盖后续记录。相同 requestId 用于不同 action 或 instance 返回 `UPGRADE_REQUEST_CONFLICT`。

QUERY 在无房间及所有房间阶段均可只读使用。UPGRADE 在无房间和 WAITING 可提交；LOADING、PLAYING、FINISHED 在账户事务前拒绝。新提交在 WAITING 成功后重绑 account inventory、角色来源和 equipment profile，并通过现房间路径取消该玩家 Ready 后广播。重放不重复取消 Ready。

## 消费者与边界

更新后的 owned `+3c/+40` 或 `+4c/+50`、`+44/+54` 继续由 `AccountStore.roleRecords`、`selectedRoleSources`、`World.bindRoleSources` 和既有 battle role recompute 路径消费。账户资料更新继续由 `roleProfile`、`World.bindEquipmentProfile` 和战斗装备来源路径消费。API 在现 `apps/server/src/accounts/api.ts` 注册，未建立第二套账户状态或免费来源。

本实现保留 owned record 的纹理、部件、期限、状态及其它字段，也保留购买、交易、维修、迷彩和其它 receipt。没有新增迁移框架、feature flag、兼容 wrapper、哈希或防御性表。原服务器结果公式、普通旧记录资格位 producer、完整 Home/M6-03/UI-33 精度和实际类型/构建/持久重启/网页验收仍保持未完成。
