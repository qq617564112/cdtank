# 维修期限到统一精通运动消费者

M2-03 / M6-Mend。同一真实账户 Tank3/pet2，普通维修使剩余分钟从0变1440后，前进速度从130变140，统一转速从0.6806783676变0.7504915595。WAITING维修重新绑定拥有来源并取消准备，普通Ready进入PLAYING后实际前进、车体和独立炮塔均匹配统一公式。

[专属驱动](../../tests/tank-maintenance-mastery-network.cts) 使用Part已验真实保存库副本和两原身份，编译服务scripts/start-server.mjs、端口3613。无新增购买、资金或拥有记录；普通SelectRole确认现Tank3/pet2，实际Equipment及profile五部件槽0。selected roleSkillSources完整六技能base/rank逐值核对，现绑定政策直接复用。

| 来源 | 实际输入窗口 | 0.3模拟秒测量 | 统一预期 |
| --- | --- | --- | --- |
| 剩余0分钟 | 前进 | 累计38.99949849单位 | speed130 |
| 剩余1440分钟 | 前进 | 累计41.99818321单位 | speed140 |
| 剩余1440分钟 | 车体右转 | 0.2251rad | turn0.7504915595 |
| 剩余1440分钟 | 独立炮塔右转 | 0.2252rad、车体0 | turn0.7504915595 |

服务端时长分别0.300/0.301/0.300/0.300秒，接收墙钟0.300/0.302/0.300/0.300秒；模拟tick固定0.05秒。距离累加连续位置，角度逐步wrap累计；坐标0.01与角度0.0001投影误差沿原数值验收容差。未用墙钟代替模拟时间。

零分钟房9、维修后房25个唯一共同PLAYING key完整players相等。四次正常round1 Leave，未开火。普通money一天维修实例1/cost25000，原生SQLite读取完整owned记录与最终QUERY相等、分钟1440。finally保存本次真实checkpoint和本地0600身份文件，再清临时库；亲3613为空。专属types8619退出0、唯一actual2749退出0。

[原始证据](../output/tank-maintenance-mastery-network-2026-10-05T20-07-49-821Z.json) 与 [有限分析](../output/tank-maintenance-mastery-network-analysis.json) 记录具体窗口。费用六分支、交易拒绝/重放、同库重启、倒退及原零分钟转向已有证据复用，本片不重复那些验收。

原MyTank+34剩余分钟getter与消息资格复用owned-tank-duration-mastery-source.json；原433ad6–433c55在+34为0时四精通减1、最低1，recompute-effective-mastery.ts为唯一路径。recomputeQualifiedRoleMovement的限幅、技能累加、精通和f32时序不改，两个预期向量只用实际record分钟与正式sources计算。

购入初始0分钟、账户维修原子扣款/期限更新、selected-bound技能和Web A/D车体+Arrow炮塔映射是明示重建。原期限递减、原role+a0写入和服务器完整producer仍未恢复；本片不宣原伤害、弹药或全部车型完成。

[独立主审](../output/tank-maintenance-mastery-root-review.json) 已接受 PASS_FINITE_SAME_ACCOUNT_TANK_MAINTENANCE_EFFECTIVE_MASTERY_MOVEMENT_DUAL_STATE_LEAVE_SCOPE，逐步累计距离/角度/模拟时长、9/25共同完整players、四Leave及原生1440分钟均已独立核验。
