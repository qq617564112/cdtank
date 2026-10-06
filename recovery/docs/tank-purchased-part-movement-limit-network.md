# M2-03 / M6-06 双装备移动负修正下限

专属`tests/tank-purchased-part-movement-limit-network.cts`首次在真实购买/装配路径验证原移动合成值下限。四Account初始零拥有/库存，普通第三玩家仅资金profile100000测试夹具→TankShop BUY104/PetShop BUY3→SelectRole→Shop BUY14002与17042各MONEY1000→不同类别PART0/1。两短合法mode3/map7房分别装配两件及卸下两件，只有普通前移输入；已有tank104/pet3无装配完整运动证据复用，不重前后/两类转向/图声或全模式。

## 原配置与资格

原tank104 TankType3、TankMove3；pet3 LTankMastery2，在当前明确owned+34=0条件下原433ad6减1得1。原item14002“厚实装甲”类别9→skill13032 Def15/ItemMove−2；item17042“天使护身符”类别12→ItemSkill1提供Lucky10/ItemMove−2。两件均原正价1000/100，各技能TriggerType0、FuncType1/FuncT65535，沿既有43372d–43376b/432fe8被动选择，无pet拥有绑定替代。

实际拥有实例state2/量1/profile+148两槽→resolveBattlePartTableIds→role array2的两个定义→ItemSkill选择。432951合成移动值3−2−2=−1，4337d7 datascale14先上界后下界限为1，再经原有效精通及f32转换计算速度50+10×(1+1−3)=40。卸下两件后原移动合成为3，公式速度60。单件3−2=1只能证明负修正，不能证明下限分支；本组合真实越界后才检下限。转向参数不改变，Lucky/Def不是本片消费者，不宣伤害或随机项恢复。

预期由实际tank/pet/owned+34/技能来源/limits/movementScales传入统一recomputeQualifiedRoleMovement，不逐车填正式速度。原TankPartSlot2→新购owned+6c仍重建复制策略，+34原购入初值及独立role+a0绑定producer未恢复；不继续重复扫描。

## 验收范围

各短房持续前移10tick，取输入生效后的相邻8～9快照测距离/模拟时间；固定tick0.05秒、serverTime与接收墙钟分别保存。两端相同room/tick的全players相等，普通Leave后分别核拥有实例仍量1/state0、五槽0及SQLite另开读出；禁止位置/伤害/事件或拥有/库存导入。本片只证明104/pet3/两负修正组合的正式下限及撤回，不以原21车型/74部件向量冒全部真实组合，M2父项不勾。

## 正式双端首验

`tank-purchased-part-movement-limit-network-2026-10-04T17-42-10-490Z.json`整体PASS，focused strict NodeNext类型PASS。真实14002实例3、17042实例4，装配两槽[3,4,0,0,0]/state2/各量1。实际统一公式装配40/卸下60，转速两条件均0.4712388813495636。

装配段0.4模拟秒移动16.00122409941095单位，实测速率40.003060248527376，server/wall 0.404/0.404秒，9共同tick全players双端一致。

卸下段0.4模拟秒移动24.000832335240624单位，实测速率60.002080838101556，server/wall 0.402/0.399秒，9共同tick全players双端一致。

8次正常Leave实际成功，SQLite另打开确认两件量1/state0和五槽0，Equipment QUERY一致，进程/tmp已清理。没有把额外Def/Lucky的存在冒作其最终消费者验证。索引tank-movement-player-accepted.json的purchasedMovementLowerLimit限定此组合，原完整车型、配装与M2父条件保持未完成。
