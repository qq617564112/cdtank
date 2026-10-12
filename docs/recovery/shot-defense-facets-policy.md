# 侧背装甲的普通命中消费

M2-01/M4-10。原Tank.SideDef/BackDef、技能增量与限幅/百分比转存已经由独立armorReady/recoveredArmor发布。伤害消费者按车体朝向与实际来向使用这些比例，原hurtSelector仅负责动作，保持独立。

Web规则将实际来向相对bodyYaw的绝对夹角分为正面（≤45度）、背面（≥135度）与侧面。正面防御修正1，侧面和背面采用当前已资格的sideDefensePercent/backDefensePercent。防御点max(0,defensePercent*100+defenseBonus)乘该修正，再用rawDamage*100/(100+effectivePoints)计算浮点命中值；HP继续使用已有整数setter。

普通2001即时命中采用目标到射手的实际位置向量；移动弹采用实际弹丸负水平速度，避免炮手移动改变已发射炮弹的方向。炮塔aim不改变目标的装甲朝向。方向只进入已资格普通炮击；医疗弹、周期burn、友伤/免伤门禁与抵消额度沿原接线顺序处理。

原字段有来源，分面阈值、合成和权威命中时序为Web重建。10821静止技能的Trigger2 producer尚未取得，不由文本推造激活。原最终公式和完整父项保持开放。

## 实际范围

正常卸装17071并保留原库存/receipt，普通车体转向后的三个2001命中分别为93.78881977161026、105.8163984842481、115.70881218126303，HP650→556→450→334；232共同完整快照、双Leave及原生两profile/owned/inventory一致。正常冷四QUERY全文与最终状态相等，实际同tempDB第二次起停恢复全文相同。详shot-defense-facets-network-root-review.json。

World五模式各两局自然模拟通过143次有资格装甲受击的三点算术和逐事件HP账，三种防御点因子计数78/43/22、本人1次复活；独立armorReady五模式均可取得，full属性VIP限制仍独立。该模拟不代替实际入射分类或网络，网页90597原生A/D三面转向与peer三次2001命中同序，sharedticks319/596/1008及两页各自tick的players全文一致，PLAYING普通Leave/FINISHED summaryLeave、双HomeClose与原生资料/receipt一致。最终主审shot-defense-facets-root-review.json。
