# 回旋饮料首槽可玩业务（M4-10-I07-B）

正常库存配置已拥有物件7到第五快捷键，对局普通Digit5经持久数量确认消费后获得10秒技能7。原ItemTurn6经已有累加/限制/精通/f32移动setter进入原转向链，实际回旋加快且前进速度保持。期限、死亡、结算与再战清理；双端快照turnBoost和本人回旋剩余时间由权威期限投影。初始库存/角色来源明确导入，不生产赠品，不写实时HP/位置/伤害/结局。

## 来源与重建边界

原物件7每局上限5、技能7 Trigger1/Target1/FuncType1 t10/ItemTurn6；首槽Effect113/SE45/Tag0/Method3、第二槽Effect10/SE02。已有原精通转向尺度float32(0.06981316953897476)与偏移float32(.1919862)，当前明确拥有来源转向0.7504915595→1.1693705320 rad/s，原速度150保持。不是另造turn24度公式；浮点顺序沿原源码。缺失完整属性或已证明移动前缀来源，拒绝且不消费。

原服务端FuncType1/3c9e资格及3c92成功消费链缺失。活战斗角色、空16技能槽、技能7不叠加、自用、持久CAS先于消费和技能写入、10秒清除/死亡/结算规则均明确重建。首槽Play7 duration0，技能7不是持续效果通知，动画自然寿命与属性10秒不同。完整第二槽触发未明，不推定到期触发。Effect113内Type4引用ww051缺失内容，适用既有原缺文件无效descriptor/finished/stop合同，不以SE45替换。完整I07/FUNC-01/M4父项保持未完成。

## 模块与验收

battle/items/turn-drink拥有资格、数量确认、技能与期限；accept-input分派普通请求；World/start保持先期限再角色弹丸和死亡/结算/再战清理。原attributes/movement未引入新公式；rooms/snapshot和协议只投影可选turnBoost；interface/battle/battle-match显示剩余时间，match/skills和render/effects执行既有首槽通知和资源。

- turn-drink.cts：源表/5次上限/源缺失、资格/空槽/非叠加/数量CAS和存储异常不写入，来源f32转向参数和其他槽保留，精确期限与死亡停止。
- turn-drink-world.json：正常原地D输入5tick，角度0.187622895→0.292342643（转向比例一致），位置不动/速度保持；期限恢复、缺源/保存失败拒绝。本人普通施放后AI与3CPU两自然局，各58实际增强转向步骤，共12死亡12复活，初始4→3→2→1/再战不补回/结算清理/Store重开槽77保留。
- turn-drink-network.json：两真实TSRPC客户端3153，普通施放首槽、同事件/同tick turnBoost、旧序列和非叠加拒绝、准确期限Stop、数量3→2、实际服务器重启库存/槽77/位值保存与账户隔离。
- turn-drink-effect-fidelity.json：Effect113独立根3010，原十节点顺序/retain与七个Type7/Type1几何实际提交、四纹理、节点控制参数、实时Tag0/SE45通知与自然/Stop/detach/runtime.stop清理。NullEngine只证明来源和几何，播放/公开纹理真实绘制另由双网页验收。

运行test:combat:turn-drink和test:combat:turn-drink:browser。双网页首槽业务通过（browser-turn-drink.json/md）：两实际1920×1080/scale1，普通库存配置/建房加入/Ready/Digit5，首槽Play7duration0/非保留记录0，同tick3双端turnBoost+6；实际Effect113七几何活Tag0/网格绘制及SE45 playing/ended双方，非叠加不扣量3→2、期限HUD隐藏/效果声音清理0、双方退出及实际服务重启正常库存×2/槽77恢复。截图处理延后到期观察不能当作实际效果寿命测量，准确权威期限另由网络验证。隔离3152/5200/9266退出，不占开发服务。

统一集成回归通过：编译账户/迷彩实际网络重启保存与CPU五模式各两局、本人速度饮料/无敌自主自然两局及首件治疗、独立两端构建、全仓类型与239正式运行边界（turn-drink-{compiled-regression,speed-regression,invincibility-regression,healing-regression,build-server,build-web,types,boundaries}.log）。tasklist仅原位勾选M4-10-I07-B，完整内容及原FuncType1父项保留。

## 自主回旋饮料（M4-10-I07-AI）

本人正常Autopilot和CPU继续只发普通PlayerInput。最终导航/瞄准输入确定后，先治疗、无敌防护、就绪开火攻击饮料、有效前进速度饮料，最后考虑回旋饮料。必须有有效原移动来源movementReady、普通turn非零，且既有原NAV/动态OBB预测与当前yaw的规范化角差绝对值大于0.000001，才申请已配置物件7槽；停转/预测完全阻塞/缺源/技能7存在/满16槽/空量不申请。阈值和优先级是明确重建AI策略，不声称原AI规则，原药效和转向算法不改。

初始CPU拥有各2份、本人持久账户3份及完整角色来源均明确导入，准备通过正式Ready，不直接写实时HP/位置/伤害/胜负。成功仍由既有普通道具权限、持久CAS和技能7属性重算处理。不能代替人类准备或再战投票，保持托管与手动序号隔离。

本片生产仅修改cpu/items和controller，协议、Web、效果、账户消费和生命周期不变，复用I07-B双1080p实际Effect113/SE45播放与清理。特效专责在既有turn-drink-effect.cts补两角色47/48一次效果并存，stop一handle或detach一角色都保持另一角色同一实例/挂点/七网格，另一实例自然结束归零；源技能7无保留通知，不能制造retained记录。此NullEngine验证身份/几何隔离，不替代真实像素和音频。

专项运行test:cpu:turn-drink，自然CPU/本人AI业务验收全部通过：cpu-turn-drink.json三CPU6次有效转向施放、186增强转向/4667停转输入、34死亡32复活、两局库存各2→0且不补回；turn-drink-ai-world.json本人3次自主施放/3CAS、94增强转向/2118停转输入、17死亡17复活、两局qty3→0/Store重开/零量重入和低序号手动恢复；turn-drink-ai-network.json真实3154两连接同事件/tick/bonus6/药效中yaw变化0.0585rad、手动隔离恢复、qty1→0/期限不续/实际服务重启和账户隔离。全程普通输入/只读观测，不注入战斗值。

相关CPU攻击/速度/无敌/治疗回归、服务端构建、编译账户迷彩联机重启/五模式各两局、全仓类型/239正式运行边界全部PASS（turn-drink-ai-{attack-regression,speed-regression,invincibility-regression,healing-regression,build,compiled,types,boundaries}.log）。回归修正旧CPU无敌夹具的整步前敌人距离观测：普通消费边界只读观察当前角色位置，保持300判定，消除同tick先行角色步进导致的陈旧样本误判。未修改生产权限或药效。

M4-10-I07-AI已原位勾选，仅关闭自主玩家业务。完整第二槽业务入口与缺失ww051声音仍保留原父项。
