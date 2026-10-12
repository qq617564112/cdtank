# 果酱4002受害者115表现合同

原来源与运行树已充分：原item3004关联3004施放技能，作用技能4002首槽115/SE47/tag0/method3；原115包含根2954、烟尘粒子2955及图纹3113。原SAV完整记录、控制器及子引用逐项与发布库相等；yan1和115的原DDS解码与发布PNG逐像素相等，SE47原WAV与发布文件字节相等，时长0.354376417秒。

来源状态PASS_SOURCE115_FLAG10_STATIC_CONTRACT_ONLY。粒子发射器寿命0.5秒，图纹寿命0.800000012秒并有四个原控制器区间；不把Func4表t5当作效果树寿命。槽1为016/SE15，当前生产采用存活成功自然恢复时单次通知；原到期调用来源未证明，新绘声实测待做，详remaining-effect-slot-integration.md。

## 原状态观察者和玩家输入

原42f6ed–42f74d比较record+126与role+36a，即flag10的当前及缓存uint8计数。变化且HP正数，new为0或old等于new+1时，原42f735压duration0、42f737压skill4002，再取角色ID并调用4886aa。此分支没有4001 flag9分支的flag6检查。该片为直接字节/反汇编，未执行新的native observer。

输入资格复用已有完整原432f91及576组真实执行证据：command3/4原地车体转向需要flag10；command0/5–8需flag9和flag10；command1/2直行只需flag9。独立炮塔方向与开火不由该移动许可控制。flag10是许可计数而非bool「果酱状态」，不借flag8将全部车体输入冻结。

## 模块与正式接线

trap4002-presentation-runtime.cts直接使用生产EffectRuntime及原115树、原纹理，在NullEngine中建立2955粒子和3113六顶点图纹，保持victim实时tag_efcenter同一引用。原有限子节点自然结束后树quiescent、实例/网格归零；owner detach和runtime stop分别清理0。状态PASS_115_TREE_MODULE_ONLY，没有玩家事件、实际像素或实际声音输出证明。

主线现已提供正式输入：正常Shop3004原价格10金币／10软星币，普通放置消费与ground3004对象、敌方接触贡献一个flag10许可计数并发布原4002首槽duration0通知，五服务器秒恢复贡献，没有flag6门禁；存活自然恢复采用第二016/SE15单次通知，原第二槽来源及新增实测保持开放。原Func12/Func4服务端实现未取得，对象、资格、计数写入与期限为明示重建。FX通知消费者复用既有BattleSkillEffects→SkillEffectNotifications→actor首槽，无需新增guard。

| 环节 | 当前证据 |
| --- | --- |
| 原来源 | 原表、115完整SAV记录、两原纹理、SE47及flag10观察者直接字节已核 |
| 运行模块 | 原115树／实时挂点／两绘制几何／自然结束／detach与stop清理已验 |
| 正式业务接线 | 主线Shop／ground3004／flag10贡献／4002通知已接，server协议与统一Web构建稳定；普通网络接触／5秒恢复／157共同tick／双Leave已验 |
| 玩家实际绘声 | 03-22-11正式接触触发：双原115低分辨率图纹可辨，受害者烟尘清楚；双SE47非零／自然end及双Leave0 |

tests/browser-trap4002-presentation.mjs复用tank-purchased-trap-turn-network-2026-10-05T03-13-11-335Z的真实购入检查点及绑定账户，战车3／宠物2、3004剩余1和槽1均为已完成普通BUY的持久状态。本片不重复购买或导入库存；正常双Ready、Digit2放置、主人W清离并A/D面向端点，客人A/D/W接触。

首browser-trap4002-presentation-2026-10-05T03-16-34-386Z.json保持INCOMPLETE：正常放置已成立，观察者37次真实输入使误差从π降至0.623，但未达到0.04门槛，未尝试客人接触。原115事件、绘制及声音均未触发。双SourceClose返回worldnull、实例／网格／声音0。此为观察驱动转向预算不足，不能判断115消费者失效。

定向补段仅将观察者远角普通A/D按键脉冲上限由100毫秒改至300毫秒，保留近角、真实yaw门槛及原10秒期限；不改变业务转速／姿态／相机。等待UI Create清理GPU后仅执行一次，检查115真实画布／SE47、自然结束、权威恢复和双正常Leave。

原Func4 writer／恢复原实现未取得，M4-09/M4-10父项保持未完成；现模块及原112、全声音库、地面3003证据直接复用，不重跑。

专属来源：tests/trap4002-presentation-source.py，recovery/output/trap4002-presentation-source.json/log。专属模块：tests/trap4002-presentation-runtime.cts，recovery/output/trap4002-presentation-runtime.json/log。无生产文件修改，无Chrome占用。


## 普通玩家实际证据

browser-trap4002-presentation-2026-10-05T03-22-11-304Z.json记录正常接触同一trapTriggered4002，目标P2、首槽duration0。两端2954仅各一次并保持player-P2挂点，原2955／3113各真实绘制，六张320×180真实onAfterRender完整画布中两端115红色图纹清楚，受害者棕色烟尘清楚；观察端烟尘独立像素未明确。首帧原elapsed分别0.0598／0.0675秒。两端树自然结束，SE47 selector1单次非loop，postgain峰值0.090874508／0.697019815且自然ended。权威trapRestraintEnded4002恢复后无trapTurnRestraint，普通SourceClose后worldnull、instances／meshes／skillvoices／treevoices均0；3004真实剩余1消费至0。

专属actual：recovery/output/trap4002-presentation-actual.json，核验tests/trap4002-presentation-actual.py。有限范围为普通触发、低分辨率原115双图纹／受害者烟尘、双SE47输出、有限树自然结束、重建状态恢复和正常Leave；HD、原Func4 writer／恢复及完整父项保持开放。
