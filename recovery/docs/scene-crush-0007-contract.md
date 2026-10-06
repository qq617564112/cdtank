# 0007 原Crush状态入口

原0007 Crush75–77/obj05420由正式ScenePreview加载完整POL，并预保留inactive原051。正式权威事务、独立快照和事件消费者已接，普通双端076射击隐藏、原051启动及正常再战/Leave已限定验收。原完整POL、DDS和c9.CVD均存在，但资源存在不证明使用Breach破坏模型或生命周期。

原Crush vtable5c76e0的+14入口45efb3调用隐藏槽+68→461dd9：立即设置对象+74=1并调用场景隐藏/导航边界。随后仅在对象+fc非空时复制+78的8字节句柄对，通过效果对象vtable+34调用启动。两次相同调用均返回true，不沿Breach的重复拒绝、alpha衰减或严格两秒隐藏。

`tests/scene-crush07-state-native.py`执行原45efb3、461dd9、45bf6c和458600，四组有/无效果与重复调用均通过。`scene-crush07-state-native.json/.log`记录隐藏标志、调用顺序、效果接收者、句柄对透传以及ret4栈平衡。场景隐藏/导航回调、效果端点为显式记录边界，不代表原导航退出或051实际执行；句柄对第二项为0的样本不证明非空句柄引用生命周期。

原loader4613fb静态指令分派obj05459/05420/05419至`_root\online\051`，47b535返回效果对象存入+fc。此为具名反汇编入口，不是完整loader执行PASS。+78首DWORD复制，次DWORD通过458600引用计数复制，不能按inline16float矩阵解释。真实句柄解引用→世界位置/姿态转换由下述矩阵producer核对，效果v34启动合同复用FX消费者。

| 原身份 | 原position | 原enabled |
| --- | --- | --- |
| 75 | [575.598938,0,-347.892670] | 0 |
| 76 | [179.723572,0,-404.040771] | 1 |
| 77 | [214.566101,0.000015,-395.664551] | 1 |

地图线负责原几何/放置/state映射，FX负责原051事件资源/触发消费者，主线负责正式许可及权威共享隐藏/碰撞清理。生产sceneCrushed事件沿原ShotItem客户端来源接入，服务器水平选择许可明确重建。M3-08父项保持未完成；本轮仅接受下述076玩家消费范围。

`tests/scene-crush07-matrix-native.py`及`scene-crush07-matrix-native.json/.log`确认矩阵producer：原基类构造连续区间44ee10→44ee62分配64字节，执行原gbengine矩阵构造函数10031f30得到identity；44e3cf→44df55→44dc5f将矩阵地址写入对象+78，24字节引用owner写入+7c，owner+10指向同一矩阵、初始引用计数1/1。原完整44de02对该首指针执行LoadIdentity、按+58的position平移、按+68/+6c/+70旋转右乘，矩阵运算及随包MSVCR71均实际执行。样本使用76位置和零旋转，输出平移与该位置一致；堆分配为记录边界，不声明完整构造、loader或原地图朝向验收。

正式效果parent provider应读取对象持有的世界矩阵，按+78首指针解引用，不能读取+78内联值，也不能将序列化OBBox矩阵直接当此矩阵。44dd58具名释放+7c owner入口已保存在source指令中；非空pair复制/释放的引用生命周期未执行验收。

三原放置的position/rotation/enabled逐值取自0007.obj；75禁用，76/77启用，三者rotation均为零。`scene-crush07-matrix-native.json`含三实例原44de02世界矩阵，`scene-crush07-transform.json/.log`为PASS_SOURCE_TRANSFORM，核当前正式placement输入与`sceneCrushTransform`输出一致。完整矩阵更新执行与三同类源数据对照不代表逐实例玩家画面验收。

`scene-crush07-caller-source.json`保存具名近端源：42b946注册4247aa，423a82保存callback，vtable5c2de0+c→42d146返回3aa4，注册名为UMsgPrNotifyShotItem。4247aa按通知+14位置/+34类型查询场景vslot48；类型不等于2时，将通知+38传入44e081。44e081先拒绝+74已隐藏，再调用派生vslot14，Crush为45efb3。直接45efb3重复接受不等于正式44e081重复接受。此为静态原客户端通知消费者来源，不证明移动接触caller、服务器射击许可或HP政策。

地图线代码`scene-crush-transform.ts`复用现矩阵运算；ScenePreview限定0007/05420加载分支用position/rotation生成稳定matrix，按原enabled设置对象可见，再调用FX `retainCrushEffect(matrix,id)`；load不触发051。`crush(placementId)`拒绝禁用或本轮已消费通知的对象，标记consumedShot/hidden后委托FX SceneCrushPresentation。clear释放全部owner，异步晚加载释放handle。共享hunk归属已获主线与FX确认。

正式快照方法`reconcileCrushes(states,round)`接收sourcePlacementId/enabled/hidden，仅设置root enabled为enabled且未hidden，不启动效果。保存最新快照以使load晚完成时直接隐藏，换round调用FX `presentation.reset()`→`stopCrushEffect`停止旧051但保留owner，再恢复原enabled并应用本轮快照；clear丢弃快照缓存。`scene-crush07-reconcile.json/.log`为PASS_RECONCILE_MODULE，真实ScenePreview/presentation与NullEngine对象核迟加载、重复事件拒绝、同轮快照无stop、换轮保留句柄和clear隔离；runtime端点为记录边界，不代效果实绘/普通事件/许可。`scene-crush07-web-types.log`为本次接线编译检查。

FX已交独立051 inactive-retain/start/release消费者及MODULE_ONLY证据；新增active stop保留同一tree/handle并可下次重启的分支已通过。主线正式合同为独立match.sceneCrushes快照，无HP/两秒淡出；合法mode1/3 map7已启用76/77的2001接受射击按对象水平OBB选取，是明确重建服务器许可，源低高度不改。当前Battle已接sceneCrushed事件及每次快照、地图异步load结束后的latest snapshot reconcile。主线负责World/shot-query/事件、碰撞隐藏与回合reset。

`apps/server/src/runtime/tick.ts`保持snapshot-before-event广播；快照隐藏与事件消费分别由hidden和consumedShot保存。快照不设置consumedShot，因此随后首个正式sceneCrushed仍启动051，重复事件拒绝；换round清零consumedShot并停止旧效果。主线`scene-crush07-wire-order.json/.log`为PASS_WIRE_ORDER_MODULE，核真实ScenePreview/presentation的顺序与复位，runtime端点为记录边界；地图线reconcile测试已按相同正式合同更新并通过。模块证据与下述普通网络及完整画面证据分别保存。

## 普通玩家证据

`browser-crush07-2026-10-04T18-02-22-466Z.json`为PASS。四认证玩家通过正式React进入mode1/map7，两端普通NAV移动，主机普通2001射击产生相同sceneCrushed76事务。两端调用时snapshot已隐藏root，beforeEnabled/afterEnabled均false，consumedShot由false变true；各启动一次原051，parent精确为原76世界矩阵，平移[179.72357177734375,0,-404.040771484375]。原2971/yan1实际绘制，效果粒子自然结束至phase3，无声音节点；四次普通fire只接受一次076隐藏事务。

已亲审同前缀完整`-natural-1.png`和`-natural-2.png`：原咖啡桌、遮阳伞、桶、椅与地面材质可辨。主机中央低位浅黄色烟尘清楚，位于原051投影范围；客机同源区域与明亮普通射击反馈邻接重叠，不能将整个亮球归为051。两端实际draw/source parent与一次消费成立，客机截图不作独立无重叠烟尘像素证明。投影范围只帮助定位，不能替代完整画面判读。

正常TIME_LIMIT终局后四玩家Rematch进入round2，两端原75仍禁用，76/77恢复启用；原owner/tree/handle保留且全部phase3，无新start或快照重播。双Leave的owners/effects/retainedCrush/meshes051/sceneVoices/battleVoices均零。`crush07-process-cleanup.json`保存专属过程清理PASS与临时目录移除。主线`scene-crush07-player-accepted.json`登记限定接受范围，tasklist原位状态由主线维护。

## 未完成范围

本次未执行普通W穿越目标平面，玩家通行未验。服务器水平OBB目标选择与许可为明确重建；完整原handler、服务器producer、非空引用pair完整loader/释放生命周期未执行验收。77独立触发、高清范围与整图恢复均不在本次实际范围，M3-08父项保持开放。

`browser-crush07-2026-10-04T17-53-07-008Z.json`保留INCOMPLETE及完整actual图片：1602条普通输入无Space，076无事务或051输出；双Leave六项零有效。具体入口记录`scene-crush07-first-route-query.json`：原P2停点至076首选ENV:45，不能由放宽ready距离推定命中。该段不作为051实际输出证据。
