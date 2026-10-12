# 速度饮料首槽可玩业务（M4-10-I06-B）

正常玩家配置已拥有“营养饮料跑得快”到第五快捷键，在对局按Digit5，经服务端持久消费确认后获得10秒技能6速度提升。原属性重算产生移动参数、既有原水平NAV/动态OBB移动链消费它；本人AI与CPU使用相同普通输入。首槽Effect110与SE42在双方网页真实绘制/播放，到期状态和HUD清除，剩余库存及快捷槽在服务器重启后恢复。

## 来源与重建边界

原物件6每局上限5、技能6/Trigger1/Target1、FuncType1 t10、ItemMove6；首槽Effect110/SE42/Tag0/Method3，第二槽Effect10/SE02。ItemMove6进入现有原技能累加、限制、精通及movement-scale10，当前完整拥有fixture原速度150→210，转速0.7504915595保持。没有引入独立速度公式或修改共享战车配置。原属性重算及水平移动的既有native对照仍有效；原垂直/坡面及后来OBB尺寸等既有未知范围保留M2。

原服务端资格/消费/目标/FuncType1实现缺失，存活战斗状态2、16槽空位、非叠加、自用、先持久数量CAS后消费和技能写入、10秒/死亡/结算清除是显式重建权威规则。原10秒取自表。缺少可用原移动来源时，必须拒绝且不消费：当前简化移动没有经过原ItemMove属性，不能消耗道具后只显示状态。完整非VIP原属性或已证明的原移动前缀可用；不伪造未知属性来源。

技能6不是原持续效果通知，首槽Play duration0；十秒属性状态与一次效果动画生命周期不同。到期发送Stop6，既有通知桥按原行为处理。Type4 ww051缺失内容与第二槽业务触发依据仍未知。缺文件行为复用ww051-loader原证据，绝不补造声音或触发第二槽；M4-10-I06/FUNC-01/全部效果父项保持未完成。

## 正式归属

battle/items/speed-drink拥有资格、事务确认后的消费和技能期限；accept-input是普通槽请求入口；World/start保持先期限后角色/炮弹及死亡/结算/再战清理顺序；原attributes/movement无新公式。协议可选speedBoost仅投影权威期限与源moveBonus，rooms/snapshot复制状态；interface/battle/battle-match显示本人剩余时间，match/skills及render/effects执行既有首槽表现。正式代码不引入取证、夹具或验证页。

## 验收

- speed-drink.cts：源表/5次上限、缺源/死亡/数量/空槽/非叠加门槛、CAS拒绝和异常无副作用、保存先于写入、其他槽保留、期限和死亡停止。
- speed-drink-world.json：普通前进5tick原位移37.4999916→52.4999964（比例210/150），到期原参数恢复；初始库存4→3，缺源/保存拒绝不扣量。本人AI与三CPU正常混战连续两局，共6个实际增强移动步骤、12死亡/11复活，逐局消费3→2→1、结算清理、再战不补库存、Store重开槽77保留。所有位置/伤害/结局由普通输入产生，私有参数只读观测。
- speed-drink-network.json：隔离真实服务器3148和两TSRPC客户端，同通知同tick、十秒Stop、旧序列/重复拒绝、数量3→2、实际服务器重启剩余2/槽77与账户隔离。
- speed-drink-effect-fidelity.json：原10节点/7几何/4纹理、活Tag0、SE42分派、自然到期/显式Stop/detach/runtimeStop释放；NullEngine几何验收不代替像素和播放。
- browser-speed-drink.json/md：两实际1920×1080页scale1，普通库存/槽4/建房/加入/准备/Digit5、实际Effect110网格绘制/活挂点、SE42 playing及ended、同tick相同状态/重复拒绝、期限HUD隐藏、退出实例声音零、真实服务器重启正常库存页×2和槽77。PNG处理延迟约6.5秒是到期后观察延迟，不当作实际效果寿命；准确期限另由网络验收覆盖。

独立runner3147/5198/9265已停止，3001/5173未占用。所有拥有库存、角色及默认迷彩通过初始fixture导入，不是生产赠品；修正fixture的未解析纹理255为明确拥有10011/10012/10013，不修改实时对局。

运行npm run test:combat:speed-drink以及npm run test:combat:speed-drink:browser。统一合并回归通过：编译账户/迷彩网络实际重启保存与CPU五模式各两局、治疗/无敌自然两局、全仓类型及238正式运行模块边界、独立两端构建（speed-drink-{compiled-regression,healing-regression,invincibility-regression,types,boundaries,build-server,build-web}.log）。类型检查发现夹具控制流无法证明副作用后状态，改读正式快照期限后类型及World复验通过。tasklist仅原位勾选I06-B；完整内容父项保留。

## 自主速度饮料（M4-10-I06-AI）

正式CPU和本人Autopilot继续只产生普通PlayerInput。actors把当前原移动参数是否有效传给控制器movementReady；最终瞄准/导航输入生成后，先保留治疗，再选择已就绪射击的攻击饮料，最后选择速度饮料。必须有前进/后退输入，且既有原NAV/动态OBB预测产生大于0.0001的水平位移，才申请普通快捷槽；缺源/停步/碰撞完全阻塞/空量/技能6已存在/16槽满均不发请求。不改原移动、药效、数量或伤害公式。此策略是重建AI，不声称原程序AI规则。

本人正常启用托管后能自主使用已配置速度饮料；不会代替玩家Ready或再战投票。原普通输入权威门槛保持，托管时手动数据不能抢控制，结束托管后低序号手动输入可恢复。CPU初始显式数量各2，本人持久账户数量3，测试通过正式绑定拥有来源后再Ready；绑定会取消准备，夹具重新确认，不绕过权限。没有运行时赠送或实时战斗状态写入。

本片只改cpu/items、cpu/controller、battle/actors，Web/协议/效果/消费模块不变。I06-B双1080p首槽Effect110/SE42、实际播放和清理/库存保存证据复用，避免重复全网页测试。完整第二槽的缺失业务生产入口见speed-drink-effect-fidelity.md新增边界，不能把包体消费器或TriggerType2/3移除stop推断为skill6/Trigger1的第二槽Play。

验收命令npm run test:cpu:speed-drink：cpu-speed-drink.cts、speed-drink-ai-world.cts、speed-drink-ai-network.cts。M4-10-I06-AI已凭实际证据勾选：cpu-speed-drink.json三个CPU6次自主消费、158增强移动/94原直线位移、4009停步输入零申请，两自然局各自2份耗尽不补回；speed-drink-ai-world.json持久本人3次CAS/138增强移动/116原直线位移/1475停步输入、10死亡9复活、自然两局及重开/重入低序号恢复；speed-drink-ai-network.json真实双连接3150同事件/同tick/实际移动、手动隔离恢复、qty1→0/实际服务重启/账户隔离。专项命令和日志保留。

统一相关回归：治疗与攻击饮料既有自主策略不变（9次治疗/6次增强开火）、服务端独立构建、编译账户迷彩实际网络重启与CPU五模式各两局、全仓类型及238正式运行边界全部通过（speed-drink-ai-{healing-regression,attack-regression,build,compiled,types,boundaries}.log）。没有重复网页、Web构建或无关原取证；完整I06内容父项继续未完成。
