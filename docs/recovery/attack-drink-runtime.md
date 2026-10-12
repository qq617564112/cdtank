# 攻击饮料限时业务

M4-10-I04正式玩家功能已经接通，任务仍未完成完整表现验收。源物件4/技能4、FuncType1的t10、Atk100/AtkBonus20、每局5份、Effect106/SE38来自combat-catalog。未知原服务端资格、Target1含义、时间生产、消费原因果不由表值推定。本片自用、非叠加、需空技能槽、死亡清除以及消费事务均明确为重建规则。

## 正式模块

battle/items/attack-drink拥有施放资格与先保存后修改的事务顺序、可选attackBoost和技能4的添加/撤回。拒绝死者/非战斗状态/空量，重复生效与已有技能4拒绝；16槽已满拒绝，不逐出其他技能。World向acceptBattleInput传实际权威时间；普通真人与CPU同一输入分派，账户数量CAS/异常不写状态。成功添加实际combat数组4槽，再由唯一recomputeBattleAttributes执行现有原重算。

projectiles只在创建弹丸时读取attackBoost，原共享TankConfig不修改。当前伤害原型35+attack*.08保持，以攻击参数tank.attack*(1+Atk/100)+AtkBonus代入；这是显式重建伤害接线，不能证明原Atk/AtkBase/防御公式。已发弹丸冻结其伤害，失效后新弹丸恢复；旧弹丸不会被回溯修改。技能槽原重算另验证AtkBonus字段+20及Atk float百分比转换，不把原重算参数当作已恢复完整原命中伤害。

服务器在每帧射击前按now>=expiresAt撤技能并重算；普通道具请求也先处理到期。死亡立即撤回，结算与开局/再战清除。原SE38和Effect106只以技能4首槽的一次通知触发，持续10秒是权威属性状态，不强制让非保留特效持续10秒。第二槽Effect10/SE02触发含义未证，没有补造阶段。快照attackBoost携带实际期限/百分比/附加值；现有重建对局面板显示剩余秒数，完成/离场隐藏。

## 已通过验收

- tests/attack-drink.cts：源参数、资格、库存/槽位、存储拒绝/顺序、非叠加、10秒边界、死亡、仅撤本技能及保留其他15技能。
- tests/attack-drink-world.cts：显式初始拥有来源、真实原属性重算，普通施放/空槽与消费上限、CAS和存储失败保留、实际弹丸攻击增强至52.6，精确到期与新弹恢复43，Store重开保存。普通CPU两局自然战斗中真人正常施放后AI托管普通移动/开火，2次施放、9次增强命中、10死亡/9复活，冻结/再战无状态残留、数量3→1；无生命/位置/伤害/胜负注入。
- tests/attack-drink-network.cts：正式隔离TSRPC3144两个连接、普通配置/建房/准备/施放，实际同通知/同tick快照、100%/+20与10秒到期，重复seq无消费、再次普通输入非叠加拒绝，实际服务重启数量3→2/其他字段/槽位和账户隔离。
- tests/browser-attack-drink.mjs：两个正常1920×1080/scaling1网页，库存页配置与普通Digit5，Effect106七个真实绘制节点/活tag_efcenter，SE38真实声音playing，双端tick3一致，状态显示/非叠加/10秒到期，离场实例声音归零及实际重启库存×2/槽4实例77。仅当前网页功能证据，不宣称流畅性能。

证据attack-drink-{world,network}.json/log、browser-attack-drink.json/log、attack-drink-effect-fidelity.json和对应图片。test:combat:attack-drink与test:combat:attack-drink:browser为专项入口。集成验收通过：全仓类型检查、234正式运行模块边界、独立服务/Web构建、首件治疗普通两局保存回归、普通装填源数学与CPU死亡复活/再战回归、编译服务账户保存/联机及五模式各两局。证据attack-drink-{types,boundaries,server-build,web-build,healing-regression,reload-regression,compiled}.log；必要集成只运行一次，UI图片/网页验收直接复用本片实际运行。

## 唯一当前表现阻塞

Effect106原树还包括Type4节点2915，引用ww051。CDTank/Data/sound/ww051.wav不存在；所有现存松散文件、data.cpk的4459条及music.cpk的14条已导出manifest无对应项，audio.json也没有引用。不能将SE38映射成ww051，不能把缺文件后现有runtime按未知声音结束的行为算原内层声音恢复。专题attack-drink-effect-fidelity.md保留native11节点、七geometry与源声音分派范围。现已取得原入口实际执行证据ww051-loader-boundary.md：直接构造文件名，无别名，缺文件返回无效描述符/finished=true/stop无设备操作，并经真实EffectSound对照。当前发行缺文件处理不再未知，声音内容仍未恢复；不继续在全部技能中无界扩展取证。M4-10-I04保持未勾选，当前代码可玩且已独立验收，其余原FuncType1/伤害与全部组合保持原父项未完成。

## 自主使用业务 M4-10-I04-AI

battle/cpu/items拥有普通快捷槽选择，controller在最终瞄准/目标/射击可用性确认后选物件4；actors提供真实装填fireReady。初步测试发现仅input.fire=true时可能仍处于装填、消费后未真开火，已改为同时要求权威装填就绪，不放宽验收。原有治疗策略原样移入此模块且优先，死亡/空量/技能4已存在/技能槽满/无可射目标不请求饮料。决策不写库存、HP、位置或buff，只返回普通useItem槽号。

现存本人托管按钮无需新UI即可启用：配置物件4后，AI沿真人输入链施放、保存并使用增强攻击。CPU显式初始拥有两份各自耗尽，自然两局共6次施放、真实增强命中、第二局零库存不补回。本人持久账户AI自然两局3份耗尽，正常消费事务/人类再战投票/新入房手动控制恢复与Store重开通过。双真实账户服务3139本人正常Autopilot/Ready后自主施放和增强命中，手动高序列隔离、停止托管低序列恢复、同tick状态/相同技能4事件、唯一份1→0与真实服务重启/账户隔离通过。源码和证据为cpu-attack-drink.json、attack-drink-ai-world.json、attack-drink-ai-network.json以及对应log；恢复/缺失的源音频范围仍由M4-10-I04父项管理，本AI验收不替代完整表现。
