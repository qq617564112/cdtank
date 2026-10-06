# M4-10-I501-AI 自主补充团队存量

仅扩展已有1UP业务的CPU/本人托管决策，不改变物件501药效、协议、资源或持久化公式。cpu/items的teamLifeHotkey读取实际已配置普通槽；BotController仍只产生PlayerInput，actors传入房间当前teamLives及原map.tankLimit。成功继续通过accept-input/team-life/账户CAS权威路径，不在AI直接修改存量或库存。

重建策略：mode1、存活且原combat.status2、两队正安全整数、本队存量低于已证正map.tankLimit才请求。初始满存量不使用，损失一条后可补一条；若当前房间数据或原初始来源无效则不自动申请。有限库存和本局数量皆需非零，不创建赠送或商城购买权限。各玩家依次生成普通输入，后一个决策读取前一个成功后的当前存量，避免为同一损失浪费多份。

既有治疗/附近威胁下无敌与防御优先；补团队存量排在攻击/速度/回旋饮料之前。已有默认弹药首个选择仍保持。技能501为即时作用，满技能栏也无需技能容量；策略不添加临时技能。

失败假设与验收：初始未损失浪费库存、敌队/其他模式申请、死亡status非2申请、空量/未配置申请、低血治疗防护优先被覆盖、连续控制器超补、AI绕过持久事务、再战补回库存、手动输入和托管序号混淆、真实重启库存丢失。策略及真正控制器专项验证资格/优先；自然CPU/本人账户两局和真实3185网络验证普通路径/死亡/消费保存。I501实际双网页Effect12与SE13源表现复用，Web及资源未修改，不重复浏览器或高清性能验收。原服务端FUNC18权限/解释以及ww051缺失仍属原父项，策略也不宣称原AI恢复。

## 当前必要检查

team-life-ai-policy.log：原子资格、空量/零实例/未分配、阈值及真实BotController治疗/防护优先专项PASS。cpu-team-life.json：三CPU自然mode1两局先后6/3次普通自主施放、709实际命中/99击毁、各库存3→1→0；每次消费边界观察当前存量已损失，逐事件扣生命/+1一致，没有对战状态写入。team-life-ai-priority-baseline.log：既有自主无敌六次自然受伤施放/真实免伤无奖励及有限两局PASS，保护未配置501时旧决策。team-life-ai-effect-authority-baseline.log：1UP现有成功/拒绝与CAS先行专项PASS。最终全仓类型、260正式模块边界和服务发行已通过（team-life-ai-{types,boundaries,build-server}.log），发行包含items策略/actors真实上下文。team-life-ai-world.json：本人自然两局2+1施放/3持久CAS先行、787命中/110死亡/25本人复活，库存3→0、Store重开原字段/槽77、耗尽重入及关闭托管seq1移动恢复PASS。team-life-ai-network.json：实际3185双账户在自然34命中/本队1死亡后自主使用501；双端相同事件、castTicks=[333,333]且严格取该tick333的双方生命[30,27]/参与者一致；库存1→0、高序号手动隔离、关托管seq1位移3.0052、真正kill/start库存0/槽77/原位值及账户隔离PASS。验收说明team-life-ai-acceptance.md；专用服务/临时库已清理，验收agent停止。M4-10-I501-AI已勾选，仅关闭重建AI业务，原FUNC18/ww051内容及I502仍未完成。
