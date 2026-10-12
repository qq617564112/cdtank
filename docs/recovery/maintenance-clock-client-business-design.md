# 维修期限客户端业务设计

M6-03-CLOCK / M5-10 / M7-07。本文覆盖 TankMaintenance 与 PartMaintenance 已确认分钟 counter 的自然期限递减链。现有报价、扣费、receipt、续期分钟增加、保存和战斗消费者复用原维修交易；本文只登记服务端墙钟、当前投影、生命周期清理和交易转移的采用规则。

## 来源事实

原 Tank owned record `+34` 是 remaining minutes，Part 维修/耐久类记录 `ownedQuantity` 是 minutes；普通 stack 不是 timed record。六按钮天数为 `1/7/30`，续期量为 `days * 1440`，上限为 `367200` 分钟，即 255 天。Tank `4935dc/495612`、Part kind4 `4935dc/495612`、请求/回执字段及原表费用行保持 `source-contract.md` 所列事实。

原服务端 clock writer、provider 和离线扣时实现未在已确认来源中出现。当前业务不声明与原服务端等价，采用服务端持久绝对墙钟推进已经获得的维修记录。

## 采用规则

新增纯服务端模块 `apps/server/src/accounts/maintenance-clock.ts`，表为 `maintenance_clock(account_id, kind, instance_id, expires_at_ms)`，三键为 `(account_id, kind, instance_id)`。初始化在 `AccountStore` 既有 `inventory/role_records` 建表后执行一次。

有 clock 时当前分钟为：

```text
current = max(0, ceil((expires_at_ms - now_ms) / 60000))
```

只有正常新维修成功的事务才建立或更新 clock。Tank/Part maintenance 在成功事务中先读取当前分钟，再校验原费用、余额、owned 与 `current + days*1440 <= 367200`，随后写回原 counter 并写 `expires_at_ms = now_ms + after*60000`。任何拒绝、失败或回滚都不改 clock、counter、余额和 receipt。

没有 clock 的旧记录继续保留原 raw 分钟与原资格；`0` 不自动解释为过期，不免费补时，不回填 clock。`maintained` 只保留完整 immutable 历史 receipt 和历史确认分钟，不作为当前时间来源。查询、重放、角色列表、inventory、owned 与交易账户视图读取当前投影；receipt replay 不扣费、不重锚、不回拨。

过期只让当前分钟归零，并保留 owned 记录、库存和装配关系。消费由现有正量门禁按当前 counter 判断；不改变 current battle 的 frozen source，不新增全局拒绝。

## 生命周期与交易

`inventory` 删除统一由 DELETE trigger 清对应 part clock，`role_records` 中 `kind='equipment'` 删除清对应 tank clock。显式导入替换沿用同一清理边界；普通 profile、wallet、迷彩、改装和其它非 owned/inventory 删除不清 clock。

Shop 与 TankShop 新 BUY 在创建真实新 owned/inventory 记录前清除同一空闲 key 的陈旧 clock，不创建新 clock，也不改变购入初值。TankShop 原 `availableTanks` 与重复购买拒绝保持。

Trade 在双方/单方物理删除前捕获原 absolute `expires_at_ms` 与当前投影 counter；recipient 实际新实例 ID 落盘后写回原 absolute expiry，并清旧 key。转移与 whole transfer、余额、款项、确认、receipt、rollback 同原事务。普通 stack 合并不计时、不改 merge、不重算分钟。

## 接口与消费者

服务端归属：

- `apps/server/src/accounts/maintenance-clock.ts`
- `apps/server/src/accounts/tank-maintenance.ts`
- `apps/server/src/accounts/part-maintenance.ts`
- `apps/server/src/account-store.ts`
- `apps/server/src/accounts/shop.ts`
- `apps/server/src/accounts/tank-shop.ts`
- `apps/server/src/accounts/trade.ts`

Web 归属：

- `apps/web/src/interface/account/mend-shop-source-page.tsx`

Tank/Part maintenance 响应继续使用现有 `remainingMinutes`；Web Mend 行优先使用 maintenance 当前投影，缺失时保留 Tank `0x34` 或 Part `ownedQuantity` raw fallback。六按钮、报价、busy/generation、状态文本、列表键盘和关闭生命周期保持原维修交易。

## 范围与剩余验收

本批已接正式实现接线，未执行测试、浏览器、构建、类型检查、重启或原生/证据脚本。原 server clock、离线 writer、完整原回执、自然递减重启、真实页面和 HD 仍待验收。`M6-03-CLOCK`、`M5-10`、`M7-07` 与完整 `M6-03` 父项保持未勾。

