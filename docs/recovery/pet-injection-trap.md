# 注射剂解除捕兽夹束缚

FUNC-10/M4-10-I03-B/M2-03。数值线owns `trap-restraint.ts`清除合同与专属rules/network/docs；主线owns注射成功CAS后解除、原flag9 provider和事件接线。重建政策将正式3003异常纳入注射剂，存活status2恢复当前许可计数加该trap贡献1，不回写旧基值；失活不恢复，重复不读写。原Func10及Func3服务执行语义未由此恢复。

`trap-restraint-clear-rules.json/log`七个新增条件通过：0/4/255当前计数恢复与回绕、重复、死亡/失活/缺许可/无状态，以及HP/正buff/技能槽保持。主线CAS-first合同引用`pet-injection-trap-authority-rules.json`，旧burn/slow相关回归独立引用，不重原13条件或120原观察者。

普通网络`pet-injection-trap-network-2026-10-05T02-24-28-234Z.json`主段通过而整体FAIL保留。复用两个真实BUYtank3/pet2账户的原生checkpoint，owner已有剩余真实3003量1/槽1；target正常Shop BUY注射剂3×2、Kitbag槽4。正常mode4/map7双Ready，普通放置/撤离/目标进入，不注入位置、HP或状态。target按键5正常用药，束缚tick49/server1791167071659、解除tick50/server1791167071709，早于原deadline1791167076659约4950ms。事件count0→1、状态删除、HP700保持，库存2→1；释放再按5拒绝无异常，仍1。普通前进5tick距离32.504，证明移动解除，不重验完整速度公式。到旧deadline后118ms仍无状态且只有一次结束事件；精确flag9单次写由局部规则证明，网络未单独投影解除后的raw计数。

151共同tick的players相等，trapTriggered、trapRestraintEnded、itemUsed3及重复itemRejected完整事件双同。模拟tick、服务器时间与接收墙钟分别保存在raw；网络请求及结束事件顺序不替代原producer证据。`tests/pet-injection-trap-analysis.py`读取同raw核验，输出`pet-injection-trap-network-analysis.json/log`，不新run。主线已有限接受专属索引`pet-injection-trap-player-evidence.json`的EVENT_STATE_CURE_REJECT_MOVE范围。Inventory业务回执有持久CAS来源，但本次临时SQLite已清理，无原生库存读证，不另造checkpoint。

限制：本次最后Leave漏必填round而验证拒绝，未验本组合正常Leave；finally断线清理不作为普通离房。runner已修为当前正式Leave合同并保存完整回执，不复跑已通过主段。首槽2错误配置拒绝raw也保留，正式消费品槽4沿原43dcc3来源；未扩trap与burn/slow组合实际或AI策略，父项保持开放。
