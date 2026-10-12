# 2007有限弹药消费

M2-02-AMMO07-B把已确认2007弹种接入每次合法开火的有限数量合同。服务端在alive/普通输入/装填就绪条件通过后、写装填截止时间和生成shot之前，读取当前特殊槽实际库存实例，核对表ID2007及拥有/本局数量。存在账户消费回调时先提交既有 `consumeItem(playerId, instanceId, expectedOwned, itemTableId)` CAS事务；成功后才将World拥有/本局数量各减1，发布 `ammoConsumed`，随后按已确认2007开火。近炮口阻挡仍是一次合法开火，也消耗1。

本合同为重建服务端规则。原3a9d实体请求入口不改数字/库存数量的证据复用 `ammo-producer-sol.md`；原服务器弹药消费producer未恢复。2007的燃烧伤害、弹丸轨迹及原扣量/补量消息因果不由本片实现。其他特殊弹种保持既有行为，未宣布有限消费完成；默认槽1/table2001无限，不调用持久消费。

末颗成功shot仍保持2007确认并携带2007事件，不提前改成2001。下一次装填就绪的fire遇到零量时，该次拒绝、不生成shot、不更新装填，确认切回slot1/table2001，并清当前接受输入对象的fire。后续普通输入可以默认2001开火。网页正常持续按键会继续发送新序号输入，因此下个held packet也可以默认开火；这不是强制松开Space的门禁。CPU下一自主输入同样可以默认射击。

CAS返回false或保存抛异常时，发布 `itemRejected` 并清当前接受输入对象的fire；库存、2007确认及装填字段保持，不生成shot，不重复消费同已接受输入。新普通输入可以再次尝试。资格/数量缺失则按耗尽策略切回默认。成功事件 `ammoConsumed` 使用既有string type合同，skillId2007、value为剩余本局量；库存快照投影及网页同步由独立接线交付。

`AccountStore.consumeItem`既有事务只保存拥有数量−1，并保留全部其他原记录字段，包括存储中的battleQuantity。World本局量独立−1；重入/再战仍按剩余拥有数量及原BattleUseMax初始化。无账户回调的CPU/明确夹具库存也走同一有限World数量变化，不伪造持久账户。

生产文件：`battle/items/ammo-consumption.ts`，`actors.ts` 的reload前 `beforeFire` hook，以及World的既有options.consumeItem handler接线。confirmation/render协议和原弹丸参数不在消费模块重写。

验证：

- `npx tsx tests/ammo07-consumption-world.cts`：真实World普通输入、实际SQLite CAS两颗各−1；false/throw零shot/reload/数量变化；末颗2007与下一次耗尽拒绝/默认、新普通默认不扣；账户隔离与原记录字段保留；无回调有限内存夹具。
- `npx tsx tests/ammo07-consumption-muzzle-world.cts`：复用原map2/route5源spawn与普通转向/驾驶可达障碍，真实近炮口fire2007先耗1、实际terrainHit及零bullet，不注入位置/生命/事件。
- `npx tsx tests/combat-muzzle-2007-glue.cts`：既有确认/拒绝、schema及首局/复活/再战默认合同回归，普通2007 shot数量断言使用当前有限策略。
- 服务端 `npx tsc --noEmit -p apps/server/tsconfig.json` 与三个专项严格类型检查。

结果保存在 `recovery/output/ammo07-consumption-world.json/.log`、`ammo07-consumption-muzzle-world.json/.log`、`ammo07-consumption-confirmation-regression.log`、`ammo07-consumption-server-types.log`、`ammo07-consumption-test-types.log`。独立真实network/双网页与服务重启验收另行登记，不以模块夹具代替。

## 正式数量同步

`PlayerSnapshot.ammoSlots`只广播各角色已配置特殊槽的表ID与本局剩余量，不含账户拥有量或实例ID。rooms/snapshot读取实际快捷槽与库存，保留零量槽；Int32快捷槽按unsigned实例查找。React BattleMatch只订阅本机角色的语义余量变化，其他角色余量不写入本机账户或本机库存显示，离房清空。原HUD弹量生产语义尚未恢复，此余量显示为明确Web业务投影。

`ammo-stock-snapshot.cts`验证实际高位unsigned实例/开局cap与生成协议往返，`react-match-store.cts`验证本机2→1→0通知、对方余量不改变本机store及离房清理。日志 `ammo-stock-snapshot.log`、`ammo-consumption-react-store.log`。
