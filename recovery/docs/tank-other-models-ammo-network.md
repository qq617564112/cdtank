# M2-02 全21车型实际普通弹药范围

21个源车型的普通弹药统一计算与实际输入证据具备：小勇士复用tank-ammo-player-accepted.json的mode4普通账户记录；其他20车型使用同一正式计算链和独立真实双连接。条件为正常新Account、请求源TankID、当前2001/4020技能，未拥有或导入宠物/战车/装备记录。该范围只证明弹药，不证明合法取得拥有角色、有效宠物技能与全车运动/攻防默认配装。

## 代码与来源

正式模块为roles/recompute-ammo.ts，共用原432951累加、4337d7限幅与433c55转换。主线attributes按实际当前技能来源发布独立magazineReady；actors用该资格执行原f32 relative deadline、预发剩余1选末发装填、成功后消费及到期补弹。所有车读取源TankDelay/TankBullet，没有逐车最终常量。

来源与单位详见tank-ammo-qualification.md。原普通2001贡献Delay17、MaxBullet6、LoadTime100；TankDelay取各自源列。规则范围的结果为普通1.3～2.3秒、容量6～9、末发3.9～6.9秒（实际值保留f32），不是统一1.7秒。当前所测无owned+34或宠物精通输入；不能把其缺失当作值0、也不能把全部车加驾驶10151的移动/转向修正。没有原Windows客户端正常行为实测，原函数执行证据与实际Node对局分别记录。

## 实际范围

tests/tank-other-models-ammo-network.cts启动一台隔离正式服务器，创建20个合法map7/mode4双人房间、40个正常空Account。源ID为2、3、4、51～54、101～105、151～158。每房依次正常CreateRoom/Join/Ready、普通PlayerInput连续开火、停火等待末发deadline补弹、普通新输入再扣一发。没有账户拥有/库存或活跃位置/生命/事件/胜负注入。

raw tank-other-models-ammo-network-2026-10-04T15-55-25-987Z.json整体状态FAIL保留。17车型raw PASS覆盖全部弹药断言、双端完整players、正常Leave。104/154/157已实际完成正确普通/末发duration、完整容量消费到0、停火补弹和新输入扣弹，但固定墙钟间隔上界检查失败；这三房未执行正常Leave，实际关闭连接/服务和临时数据库。

analysis文件只检查这三房尚未确认的时钟资格与双端一致性，复用17房有效PASS。记录显示每次发射都在原相对deadline后的第一个可用服务tick，期间不存在已越过deadline的可用tick却未发射；绝对毫秒投影与f32相对秒数允许1ms转换误差。完整players按同room/tick/phase逐值一致。没有放宽固定误差阈值或将原raw状态改PASS。

接受索引为tank-ammo-player-accepted.json.otherModels，引用同名-analysis.json的PASS_AMMO_SCOPE_ONLY及原raw FAIL。20车型与小勇士已有证据合并为21车型明确普通弹药条件；其他宠物/实际装备/生效技能组合仍未覆盖。

## 限制

实际服务tick出现240ms、273ms与1330ms停顿；三车观测普通间隔最高2.477秒（参数2.3秒）及2.075秒（参数1.9秒）。这些是当前服务节拍下的实际延迟，原装填duration并未改变；本片只接受deadline资格和有限弹药状态，不能宣称实时节拍或原客户端时间精度通过。模拟tick×50ms、serverTime/发射startedAt及接收wallTime各自保存，不互相替代。

独立pet boundGear生产入口、10151实际生效资格、owned+34购入初值、首车完整角色取得及全21运动/转向/攻防组合均未恢复。普通2001安装、初次满弹、扣弹/末发deadline补弹和生命周期策略仍明确为原服务端缺失重建规则。完整M2-01/M2-02/M2-03不勾。

## 命令与状态建议

```sh
npx tsx tests/tank-other-models-ammo-network.cts
npx tsx tests/tank-other-models-ammo-network.cts --analyze recovery/output/tank-other-models-ammo-network-2026-10-04T15-55-25-987Z.json
npx tsc --noEmit --strict --skipLibCheck --target ES2022 --module NodeNext --moduleResolution NodeNext --esModuleInterop tests/tank-other-models-ammo-network.cts
```

类型日志tank-other-models-ammo-network-types.log，实际服务.log、run.log与analysis.log保留。来源与正式计算代码无改动，不重跑native或小勇士既有PASS。

M2-02原位建议登记“全21车型当前2001/4020、无拥有/宠物/装备来源的实际有限弹药scope具备；tank1复用，其他20实际双连接17 rawPASS+3 deadline/sync分析。rawFAIL/服务停顿与三房正常Leave未验保留，不宣实时性能及全配装修正。”主线须亲审原始时钟与有限接受范围，父项继续未完成。
