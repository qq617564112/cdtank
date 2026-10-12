# 宠物饲料恢复加成

Pet103 的 Skill0=10811，SkillLv0=5。首次学习槽0花费10原始技能点，owned rank+5c 从0变1。10811 的 Trigger0/Target1/Func1/T65535、HPRegainRate20 与原说明“吃宠物饲料时，恢复120%。”共同限定饲料恢复加成。

原432951把 HPRegainRate 累加到角色浮点+8c，4337d7经DataScale3门禁，433c55转换为float32比例。完整重算与选中来源复用既有证据，具体索引及原表字段保存于 `recovery/output/food-healing-source-contract.json`。角色浮点+8c不同于技能来源recordFields+8c。

正式纯函数 `apps/server/src/battle/roles/food-healing.ts` 接收基础HP和已资格化比例。服务端采用明示Web取整 `Math.round(baseHP*(1+(qualifiedRate??0)))`；角色资格由调用者在 attributesReady=true 时读取 combat.roleFloatFields+8c。无资格时基础200/400沿用。现有最大HP夹取与库存CAS消费负责最终治疗。

`tests/food-healing.cts` / `recovery/output/food-healing.json` 已通过float32边界验证：20%比例为0.19999998807907104，小包恢复240、大包480，无资格小包200。

## 网络准备

`tests/food-healing-purchased-network.cts` 使用端口3619。合法已购账户checkpoint资金沿用，仅开服前Point10夹具明确非earned。普通BUY103、学习10811、BUY两小包，普通炮弹自然造成足够缺血后按键使用一包。

首actual `recovery/output/food-healing-purchased-network-2026-10-05T20-58-15-280Z.json` 保存恢复240、库存余1、169共同完整快照、关键事件一致和双方正常Leave。runner26459 exit1，原始FAIL保留；尚未完成同库重启。原生备份180224字节，identity权限0600，finally清理且端口3619为空。

库存持久记录的battleQuantity=0；QUERY重新投影为1，ownedQuantity均为1。两者分别核对，其余原字段逐值同。`FOOD_HEALING_TAIL=1` 准备分支沿首actualcheckpoint只验证原生记录及同库重启，不重复取得、学习或治疗。

对局内QUERY使用 world.inventory；离房后QUERY使用 accounts.inventory 原生持久记录。冷恢复逐值核对持久库存及原资料，再以同database实际起停后的QUERY全文验证重启。第一次尾raw `recovery/output/food-healing-purchased-network-2026-10-05T21-01-14-629Z.json` 保存完整native断言，runner48107 exit1，重启范围仍未接受。

有限wrapper为 `recovery/output/food-healing-purchased-network-analysis.json`，最终主审回链 `recovery/output/food-healing-root-review.json`，状态 `PASS_FINITE_PURCHASED_LEARNED_PET103_FOOD240_DUAL_STATE_NATIVE_STOCK_RESTART_PAGE_CLOSE_SCOPE`。网络首段与native分别由 `food-healing-network-first-root-review.json` / `food-healing-network-native-root-review.json` 登记。

UI3620定向首验runner3834 exit0，普通CPU自然受伤后nativeDigit5产生单次itemUsed240，余量1→0，607共同完整快照一致、两Leave和严格Close通过。正常离房Inventory/PetLearning查询作为基线，同数据库实际停止、重启、重新认证后的双方完整QUERY相等；native技能等级、资料、余额和库存均有对应核验。具体UI主审为 `recovery/output/pet-food-healing-browser-root-review.json`。网络两份原始FAIL范围保持，未追加第三次网络尾运行。

## 限制

原服务器最终治疗舍入和Point取得尚未恢复。本片不证明自然回血、周期技能、原+a0绑定或完整服务端伤害公式；学习初值与选中binding沿正式Web重建合同。

## HPRegainRate字段消费者索引

当前原目录HPRegainRate非零定义仅10811–10815，原Info逐级限定“吃宠物饲料时”恢复120/140/160/180/200%，对应增量20/40/60/80/100。DataScale3“生命回复率”原限0..999，单位经f32百分比转换；不把表名解释成每秒HP或period。正式healing.ts和cpu/items.ts均在attributesReady资格后读取roleFloatFields+8c并消费calculateFoodHealing；普通BUY103/LEARN10811→food240现有主审完整复用。这个字段已消费，不新增周期恢复、医疗加成或内容变体验收。精确索引保存在food-healing-source-contract.json的qualifiedConsumerIndex。
