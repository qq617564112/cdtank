# M2-02 / M6-06 正价射击装置取得与弹药消费

`tests/tank-purchased-part-ammo-network.cts`仅检查新取得装备来源对普通弹间隔、末发装填及有限弹匣补弹的消费者。真实Account初始零拥有/库存，目标profile仅测试资金100000→TankShop BUY3/SelectRole→Shop MONEY500 BUY15001→Equipment PART0→正常mode4双人普通PlayerInput持续开火。没有宠物拥有/绑定夹具，不注入活跃位置/HP/伤害/事件；已有购车、普通2001基本安装及换弹证据复用。

原item.dat：15001“锈蚀的射击装置”，ItemType10、ItemMoney500、ItemCoin50、ItemSkill1=13081。原skill.dat技能13081为TriggerType0、FuncType1/FuncT65535，唯一非零数值Delay−2。实际实例state2、profile+148→role array2定义15001→43372d–43376b/432fe8被动选择13081，经统一432951累加Delay；原limits16及转换得到clamp(TankDelay−2,5,99)×f32(.1)。末发仍共用2001 LoadTime和原f32(.03)，不另写射速常量。

实际tank3的公式预期容量7、普通1.3000000715255737秒、末发3.8999998569488525秒，以模块实际输出及raw为准。新购owned+6c采用原TankPartSlot2复制的明确重建政策；原server购买producer/出售授权未确认，已有账户/receipt不迁移，owned+34原语义及初值未恢复。未把selected pet当boundGear，也不把弹药资格PASS称全部原配装恢复。

测量在首弹匣每次剩余变化、0→补弹后继续消费及补弹后首次消费记录原快照tick/serverTime，双端共同tick及火事件一致；固定模拟tick0.05秒，wall接收采样独立。只运行新装配影响范围，不重复全部车型、特殊换弹、生命、运动或原native。M2父条件保持未完成。

## 首实际消费者证据

raw `tank-purchased-part-ammo-network-2026-10-04T17-22-30-394Z.json`保留整体FAIL，专属同raw分析为PASS_INSTALLED_DELAY_CONSUMER。真实取得15001实例2、余额97000、Equipment PART0/state2/库存1；无pet仍独立弹药资格有效。selectedSkillIds2001/4020/13081，容量7、普通1.3000000715255737、末发3.8999998569488525。

首弹匣消费tick2/28/54/80/106/132/158，剩6→5→4→3→2→1→0，各普通间隔26tick=1.3模拟秒；末发至补弹后继续开火tick236为78tick=3.9模拟秒。持续held输入下补弹与下一次消费同tick，公开剩量0→6，未发布满7的中间快照。首脚本将满快照作为断言，故整体FAIL；专属分析检查已发布补弹后剩量、八次真实fire、原reload.duration、实际时间和双端，未修改raw。正常间隔server1.302～1.309秒，末发3.918秒；墙钟单独记录，完整指标见-analysis.json。

两端236共同tick全players及本人八次fire一致，进程/tmp断连清理完成。首失败发生在退出与最终持久读之前，故本片没有正常Leave或对局后持久库存首验；不能把断连清理等同普通离房，也不复用旧normalLeave包装本房。未重跑实际对局，已有部件装卸持久证据仅限16001组合。索引tank-ammo-player-accepted.json的purchasedPartDelay待主线亲审限定scope，父项不勾。

## 卸下消费者与正常退出保存首验

`tests/tank-purchased-part-ammo-unload-network.cts`与raw `tank-purchased-part-ammo-unload-network-2026-10-04T17-28-16-022Z.json`为PASS，focused strict NodeNext类型PASS。另两个初始零拥有/库存Account，资金-only→真实BUY3/15001→PART0；无pet。两个短合法mode4/map7房各一次普通开火，装配时真实reload.duration1.3000000715255737，卸下后1.5；selectedSkillIds对应新增/撤回13081，容量都7，实际剩量7→6。只验新装备来源撤回，不重连续弹匣或末发计时。

两个房分别6/6共同tick全players双端一致，本人各一fire事件双端相同；4次普通Leave实际成功。SQLite另打开读取实例2/15001/量1/state0及profile五槽全0，Equipment QUERY全0，服务/tmp清理完成。输入至首shot模拟秒分别0.05/0.05，server秒0.051/0.05，wall秒0.052/0.051。新购+6c2仍明确重建初值。

此新raw补齐本组合正常离房、保存终点与卸下后的普通装填恢复，不把前一raw整体FAIL改为PASS，不宣原购买producer、完整伤害或所有配装。索引purchasedPartDelayWithdrawal与前一purchasedPartDelay分别保留范围，M2父项不勾。
