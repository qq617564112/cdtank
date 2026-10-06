# 宠物注射剂解除燃烧

M4-10-I03-B实现普通item3自用解除已交付燃烧状态。原Item3「宠物注射剂」说明可解除宠物所有异常，链接skill3/0/0，本局上限5；原skill3为TriggerType1、Target1、Range0、FuncType10（T/X/Y/Z均0），数值属性含HP全部0，第一表现槽为Effect18/SE17/tag0/method3。原表与既有 `skill-function-coverage.md` 来源复用，不新增FuncType10逆向。

原`CDTank/Data/table/item.dat`记录3直接给出ItemMoney10、ItemCoin10、D2图标3、ItemType1。M6-06-I03正式商城复用该原价格与名称；当前10件出售目录只开放已接入消费功能的道具，原出售资格未知，仍按重建购买权限处理。Item3落现Item分类，原daoju0/00003.tga的32×32 DDS图为ui/regions/57/2.png；不从ItemInfo推断完整异常枚举。

原服务器FuncType10的完整异常清单、目标授权与清除流程未恢复。当前资格/清除为重建自用规则，仅解除已有权威2007 burn；正面饮料、无敌及其他boost保留，不宣称原“所有异常”完成，FUNC10父项保持未完成。

`applyPetInjection(roomId,player,request,consumeItem,events)`沿现有道具合同：存活/status2、useItem请求、对应item3且拥有/本局量均大于0、原skill3/trigger1/target1/Func10核验后执行。无burn发送itemRejected，不消费。账户CAS先成功，再数量各减1并clearAmmoBurn，发布itemUsed/skill3及effectIndex0、duration0、自身roleId的playSkillEffect通知。保存false/throw保持burn及数量，发送拒绝；无账户回调沿已有内存道具消费策略。

成功不改HP，不写长期16技能槽，不清正面状态，不自行渲染。原Effect18/SE17消费者沿正式通知入口复用；实际Digit5请求、持久账户和玩家可见停止后续burn tick由root集成与专项真实对局验证。

`npx tsx tests/pet-injection.cts`通过成功/CAS-first回调时刻、无burn/false/throw原状态保持、重复使用不消费、未来burn回调停止、正面attack/invincibility对象及HP/角色数字/技能槽保持、死亡/status/空量/错误kind或item门禁与原表现槽来源。证据 `recovery/output/pet-injection.json/.log`。
