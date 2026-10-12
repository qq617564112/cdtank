# 五部件被动光效

M6-01/M6-06/M4-09/M4-10：正常Shop部件购买17031或17032→Home五部件装配→已确认账户归属与实例/state2→合法房间/Ready→双端角色出生显示原31或32→正常Leave→卸下/重启保存终点。root owns passive-part-effects.ts、RoomSnapshot投影/协议、queued-part-effects.ts及Battle角色生命周期接线；FX owns既有原通知/资源映射、首次普通绘制与静默验收。UI与购买装配事务沿已交业务复用。

原item17031/17032是分类12，价格1500金币/150软星币，分别指向被动13501/13502。原Trigger0、Func1.t65535和Effect31/32/tag0/method3/sound0直接确认。原角色array2五表ID经既有selectRoleItemSkills过滤；输入来自resolveBattlePartTableIds已核本账户实例、数量、state2与类别/定义，房间开局后沿现归属冻结规则保持。

新增PlayerSnapshot.queuedPartSkillIds是重建权威投影，仅13501/13502；不授予技能、不写array4、不改变数值或耐久。快照保持资格，使晚载入角色不会丢失一次通知。客户端仅对已加载战车，在PLAYING且alive时把首槽消息交原SkillEffectNotifications.play入队，再调用原revive。原多项队列五秒轮换继续由现真实frame秒数推进，未重写时基或延长原资源。

同资格快照不重复入队。死亡/非PLAYING清本角色queue；出生重新按原首项激活；角色替换/离房/回合结束沿现clearRole/clear释放。queue专属清理不移除持续消耗品record，也不停止该角色的全部效果。原服务端被动授权、出生通知生产与重建快照时序分别记录，不把Web快照当原协议。

queued-part-effects.json模块验证实际归属过滤、原被动选择、原通知队列入场/不重复/5秒边界/轮换、死亡停止、复活首项/移除/回合重新入场，以及持续skill8不受queue清理影响。queued-part-player-loading.log核BattlePlayers资源尚未可用不调用，加载后保留权威资格且WAITING不激活；queued-part-notification-bridge.log复用原Play/Stop消息桥与队列规则。普通购买、实际像素、双端与持久终点须另收，模块不代替这些验收。完整父项开放。

首次React来源与实际绘制已主审role-queued-glow-actual.json：正常BUY17031/真实EQUIP槽0，双快照P1=[13501]，原2500树/2601与2882实际绘制，双完整320x180画布周围黄色粒子可辨，正常Leave三效果/声音owner与Battle均0。预房native战车宠物及资金2000/0明确。通知调用观察包在外层play，未记录内部reconcile直接play的顺序；播放期声音创建轨迹未收，不把sound0原静默来源当实测声波。双部件/13502像素、自然复活绘制及HD保持未验，不为已有31画面重复run。

联机有效段queued-part-persistence-network-2026-10-04T20-57-51-256Z.json整体FAIL保留：全空拥有/仅资金10000→正常BUY战车3/宠物2/17031与17032，各EQUIP槽0/1；普通默认2001自然17次伤害至死亡tick685与复活tick745，745共同tick双端全部players相等、权威资格均[13501,13502]，非拥有与对局配置拒绝。正常Leave/真正进程重启恢复部件实例3/4各量1state2、槽[3,4,0,0,0]、余额1000。最后新房读取旧同名R6快照导致整体失败，未据此宣卸下无资格；定向尾段使用新收快照边界，不重自然死亡。

queued-part-effects-business-accepted.json组合接受本片：有效自然死亡/复活联机段与20-59-42定向持久尾段相互补足；后者正常新购买装配/双端权威资格→Leave/真实重启库存槽余额→卸下两槽→新收到的PLAYING两端资格均空→正常Leave/Equipment槽全0。最后角色/部件state持久保存与新房无陈旧资格通过，未重自然死亡。Web原31首入场可见片直接引用，原完整13502和复活画面仍开放。

工程：queued-part-server-types.log、queued-part-web-types.log、queued-part-tests-types.log与queued-part-server-build.log通过。queued-part-healing-life-regression.log确认原治疗死亡/复活快照、结束和移除不受新queue影响；旧NullEngine角色fixture缺现已存在trackMovementTarget，原失败日志保留，补实际fixture方法后通过，未修改生产运动行为。统一Web工程发行另收。

queued-part-map-channel-web-build.log统一Web严格类型与Vite1m26s构建通过，含新增快照codec/正式queue生命周期和本批地图选择/频道页面consumer。
