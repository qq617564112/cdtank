# 2007弹种权威确认与炮口显示合同

M4-09-COMBAT-MUZZLE-2007的服务端合同已接通：普通数字键通过既有库存数量/分类和原426419请求门禁后，重建服务端把快捷槽实例实际ItemTableID写入角色当前确认字段，并随快照发布。槽1确认2001；配置拥有2007的槽2确认2007。原服务器确认产生规则未恢复，本合同明确为重建接受策略。

`battle/items/ammo-confirmation.ts` 提供 `confirmAcceptedAmmoSelection`，先取得全部确认输入，再调用已恢复的槽setter（属性6）及当前表ID setter（属性7）。缺数字记录、缺快捷槽/库存实例、非弹药类别或空本局数量不写确认。accept-input调用位于原键盘/请求门禁后；等待/结束、死亡、旧序号输入仍由现有上游拒绝，不改变确认。

PlayerSnapshot的可选 `ammoItemId` 字段是重建服务端确认的ItemTableID；正式快照始终取角色 `currentAmmoTableId`，不从快捷槽号猜物件，不要求网页重复查库存。正式fire事件的skillId以及free/scene shotDisplay.itemId消费同一确认表ID。player-target分支仍省略shotDisplay，原分支静默合同不变。

原角色数字构造已明确槽1、表ID2001。原status2 setter清flag/deadline但不重置弹种，故首局/再战 `initializeBattleParticipants` 与复活 `respawnPlayer` 显式调用 `resetConfirmedAmmo`，同时重置槽1及表ID2001；这是重建生命/局生命周期策略，不冒称原服务器规则。拒绝不改确认，死亡期间保留已确认字段，复活后投影默认2001。

源目录Item2007第一效果槽为Effect54/GA09/tag0/method3，用于原virtual+a4炮口效果名称选择；第二槽为Effect0/sound0/tag6/method3，当前世界shot显示映射保持静默。其第二技能ID4005自身有Effect14/SE03及Effect7/SE30等技能效果，不能据Item第二槽零值宣称整个Skill4005静默，也不据原说明实现未恢复的燃烧伤害触发。炮口消费者及双网页绘声由专属FX任务验收。

`npx tsx tests/combat-muzzle-2007-glue.cts` 验证真实World普通输入选2007、fire权威字段、生成schema的快照/事件往返、拒绝保持确认、切回默认、自然时限结束及普通同意再战默认重置。显式角色生命周期夹具调用实际respawn/start模块验证reset接线；不能用其替代网页自然死亡复活。确认/开火未改变拥有或本局数量。

证据为 `recovery/output/combat-muzzle-2007-glue.json/.log`；服务端类型检查 `npx tsc --noEmit -p apps/server/tsconfig.json` 通过，日志 `combat-muzzle-2007-glue-server-types.log`。全仓检查的旧tests严格类型错误保存在 `combat-muzzle-2007-glue-types.log`，本片没有改这些测试。请求/数字字段原合同复用role-ammo-request、selection和record-defaults证据，未扩大耗弹、伤害、轨迹或原服务器producer范围。

相关规则回归：`tests/role-ammo-request.cts` 原请求门禁、`tests/combat-shot-target.cts` 原目标选择/静默向量、`tests/combat-shot-world.cts` 普通默认2001 shot与自然CPU目标分支通过，日志分别为 `combat-muzzle-2007-selection-regression.log`、`combat-muzzle-2007-shot-target-regression.log`、`combat-muzzle-2007-shot-regression.log`。shot World夹具房间名使用正式8字限制内的Shot，原断言保持。`tests/item-request-world.cts` 现按正式业务确认item79普通请求与满血拒绝两事件、无消费/空量/旧序号与再战数量初始化；preparation-ammo-item-input-regression.log PASS。其原单请求事件断言失败日志保留；实际消费模块已接入时不能继续把请求数组中所有事件都当作请求。
