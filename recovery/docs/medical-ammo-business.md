# 医疗弹命中治疗

原item2009医疗弹说明被命中者增加300生命，原skill4007 Trigger8/Target5/Func2/HP300及第一槽011/GA15直接提供数值与呈现。skill2009被动说明的100未用作治疗数值；其HP字段为0，命中技能4007才提供300。

正式2009弹丸命中角色后，由medical-ammo.ts调用既有setBattleHealth及原生命赋值限幅。存活/status2目标接受治疗，恢复量=min(300,当前缺血)，生命值、角色属性record及combat字段+54同步。满血合法命中恢复0；弹药已在开火前通过CAS消费，不退弹。目标资格、友敌均可治疗/无命中计分和商城开放为现服务端重建政策，原server许可未恢复。医疗弹不落普通伤害、受击、击杀分支，不清除燃烧或正面状态。场景/城堡/破坏目标不套用默认损伤。

结果使用既有MsgRoomEvent结构：type=playerHealed，playerId射手、targetId受害者、skillId4007、value实际恢复，shotPlayerResult.itemId2009，无hurtSelector。Battle转发受害者原011/GA15，普通hit才进入伤害动作。生成的既有wire codec可完整传输此结果，无新增包类型或原协议声明。

正式商城沿现重建库存商品取得事务开放原报价5金币/10软星币，库存class3有限消费/失败不扣沿统一CAS政策。不会免费授予普通账户库存。

## 验证

medical-ammo.json模块通过原300、50→350、650→700、700→700限幅与三个生命消费者一致、无效状态无结果、其他弹种不处理。medical-ammo-world.json通过正常World输入从原spawn转炮塔/普通2001致伤257/300→正常选择2009弹丸恢复43至300，无额外hit/击毁/命中得分，库存2→1及既有wire往返/正常Leave。World库存和持久回调为明确模块夹具。

medical-ammo-server-types.log、medical-ammo-web-types.log、medical-ammo-tests-types.log、medical-ammo-shop-catalog.log和medical-ammo-server-build.log通过。medical-ammo-business-accepted.json组合双React与真实重启网络验收：空弹库存正常BUY2、余额100→90、Home实例1槽1；普通2001造成157/200伤口后2009双同playerHealed恢复43至200，原011绿色环/粒子及GA15结束、Leave清理。medical-ammo-persistence-network-2026-10-04T20-02-41-413Z.json另验余额不足拒绝与真正服务端重启，同token恢复余1发、槽1实例1和余额90。原tank1/pet1拥有及资金为明确预房夹具。原目标许可/伤害和弹速、全部网络条件与高清精度保持未完成。

完整300恢复另由medical-ammo-full-heal-accepted.json限定接受：两个空账户仅资金夹具，正常BUY3/pet2与SelectRole、BUY2009及真实槽实例，普通2001七次命中造成700→385的存活伤口，再正常选择医疗弹真实385→685、双同4007/value300且无hurtSelector、射手得分不变，库存1→0。364共同tick及两次正常Leave通过；源技能HP300、目标政策与已有绘声/重启证据复用。本片不扩大原目标许可、完整伤害或高清精度。
