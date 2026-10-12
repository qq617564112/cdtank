# 普通场景结果type2静态盒反馈

原场景虚表5c7178由构造45aba5写入；virtual+48是4591a4。该查询按第二参数0..7选择八个独立vector，type2明确读取scene+1bc/+1c0，所属vector为+1b8。加载45b791–45b811使用5c7214字符串`.box`打开源文件，将读取流交给+1b8，再合并至总对象表+188。这条身份链指向原静态BOX，不是Castle或非致死Breach。

原4247aa找到攻击者与对应场景对象后，type2跳过44e081破坏、角色+314计数和457ca0场景导航更新。远端仍将message+3c/+40/+44结果端点交423956，再把攻击者与物件ID交423092。本机、攻击者缺失、盒查询缺失不显示反馈。查找用message+14位置，与结果端点是两个独立坐标区。

`tests/scene-shot-type2-source.py` 执行真实场景virtual+48、4591a4 type2选择及完整4247aa，共六个本机/远端/角色缺失/对象缺失组合。原几何find458e9e、角色查找和已验显示/声音末端为供给边界；调用次序、栈清理及不破坏/不增计数均通过，见scene-shot-type2-source.json/log。原BOX来源与查询身份来自原代码直接字节，不从kind值、类名邻字符串或Castle HP推断。

现TankShotItemResult消费普通2001远端端点007/SE30→Shot GA07。正式World仅在普通2001真实查询首目标为来源静态BOX、且本事务没有物件损坏结果时，发布sceneStaticHit与冻结物件2001/查询端点。terrain、动态ENV/CASTLE/CRUSH与特殊弹药不进入本分支；不破坏、不改HP。静态身份映射、通知授权与服务端调度为明确重建。scene-static-hit-authority-rules.json/log与正式serverbuild已通过。

## 最小普通射击入口

scene-shot-type2-entry.cts/json/log只读原map7出生点与正式queryShotTarget，BOX29中心[-96.052765,45.322433,528.991333]距spawn0为298.599536，正常炮塔目标yaw为-1.200480234。正式普通输入使用真实购入tank3/pet2的原生数据库检查点并严格绑定账户；没有新导入角色或库存，也没有活跃状态注入。来源入口计划与真实命中身份分别记录。

scene-shot-type2-actual.py核对真实源BOX身份、双端同sceneStaticHit/冻结2001、本机结果静默、远端观测draw与自然结束、SE30媒体输出及GA07衰减后输出、生命保持、双正常Leave。像素可辨范围单独亲审。

## 普通玩家限定实际

`browser-scene-shot-type2-2026-10-05T02-04-11-611Z.json` 完成普通双React map7/mode4、已购入tank3/pet2检查点、Arrow瞄准、普通2001静态命中与双正常Leave。实际首目标为原BOX8，结果端点[-523.695068,25,728.609680]；两端同sceneStaticHit携带冻结2001。计划BOX29不是实际命中身份，不能替代原结果。

本机反馈、结果效果及结果声音为0。远端反馈一次，007根2432五节点建立，其中2433/2434/2435实际绘制并自然结束。SE30真实媒体输出峰1.031477、音量0.5、playing/ended；GA07 id48位于射手[182.31,0.32,420.93]，衰减后输出峰0.547302，单次ended。媒体采样不是扬声器最终音量输出。双正常Leave的world、效果实例、网格和BattleSound声音全部0。

首结果帧elapsed0.2728，后两帧1.0185/1.6027；原2447寿命0.25，2448寿命0.150000006，两者在首绘制前已越过源寿命，未记录draw。实际帧delta272.8/745.7/584.2ms，不能把3/5归因于资源缺失或修改原时基补图。三张rendercallback完整640×360画布未见足够可辨爆烟，像素保持未接受。

`scene-shot-type2-actual.json` 为事件、已观测draw、真实声音、自然结束与双Leave限定接受，allFiveDrawn=false、pixelAccepted=false。完整原节点实绘、可辨像素及高清性能仍开放。原raw独立保留。

## BOX29短节点与低分辨率像素

browser-scene-shot-type2-visual-2026-10-05T02-12-10-247Z.json记录普通Arrow释放后连续三个较晚快照的yaw/aim稳定；Space前生产query首目标29。真实双端sceneStaticHit为BOX29，端点[-91.052765,25,529.145508]。观察端通过普通Arrow面向结果端点，原视野与角色位置保持。

三个真实onAfterRender画布为320×180。首帧elapsed0.0817实际draw2434/2447/2448；elapsed0.361补2435，0.5085补2433，累计原五节点实绘并自然结束，并非五节点同帧。result-canvas-2-0原爆火可辨，2-1/2-2亮黄白爆烟可辨；该像素范围只覆盖低分辨率整画布。源寿命、生命周期及renderer均保持原合同。双正常Leave后worldnull、效果实例/网格/声音全部0。

scene-shot-type2-visual-supplement.json独立保存该补段，不覆盖BOX8首片的allFiveDrawn=false/pixelAccepted=false。完整原viewport、HD与全部场景效果父项仍开放。
