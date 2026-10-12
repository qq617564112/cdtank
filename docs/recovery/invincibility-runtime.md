# 无敌软星可玩业务（M4-10-I08）

玩家在我的家配置已拥有物件8到第五快捷键，正常对局按Digit5，账户保存成功后消费一份，获得10秒炮弹免伤、原Effect100实时挂点表现和剩余秒数；双端同步，到期停止，结算/再战清理，剩余库存及槽位保存到重启。没有生产赠送道具，验收使用显式初始拥有库存；没有注入对局HP、位置、伤害或结局。

## 来源与重建规则

原目录物件8“无敌软星”：技能8、Target1、TriggerType1、FuncType6参数t10，每局数量上限2；首效果100、Tag0、Method3、Sound0。目录对照由tests/invincibility.cts执行，Effect100原tree fixture由tests/invincibility-effect.cts逐节点对照。原树根2992，四个Type7子节点2993–2996，三份公开纹理齐全；无Type4声音。Sound0真实handle0，不添加声音。

原服务端FuncType6、3c9e资格与3c92消费原因果缺失。自用目标、存活且战斗状态2、16槽必须有空位、已有技能8拒绝叠加、持久数量CAS成功才消费、炮弹命中不掉血且不奖励攻击者命中分、到期/死亡/结算清除，均为显式重建权威规则。10秒来自原表，不据此声称恢复原服务器函数或伤害公式。既有同队射击门槛先于免伤判断，实际弹丸命中后正常删除。

## 正式模块与顺序

服务端battle/items/invincibility拥有资格、消费、临时技能槽及期限；accept-input只解析已有普通槽请求并分派；World每步在角色/弹丸前检查期限，life在现有伤害路径检查免伤，start/finish与死亡负责状态清除。accounts原事务持久消费复用。rooms/snapshot与共享协议只投影可选invincibility状态；web/interface/battle/battle-match显示期限，既有match/skills通知桥执行Play(duration10)/Stop。

技能8通知保留状态和效果树retain标志是不同合同：生产manager创建树retain=false，四节点零寿命直到通知停止；原通知按每30仿真步扣一秒，累计300步到期。服务端真实时钟到期发Stop8，保障网页原帧调度暂慢时仍服从权威停止，不替换原调度器。

## 验收与证据

- tests/invincibility.cts：原表值、普通资格/空槽/非叠加/CAS失败与异常不写入、16槽保留其他技能、期限/死亡/清理。
- invincibility-world.json：正常Digit5、实际三CPU炮弹碰撞保护和每局到期后真实受伤，两局自然结束/再战、数量3→2→1、账户Store重开槽77保留。每局分别统计免伤命中及期限后正常命中。
- invincibility-network.json：真实隔离服务器与两TSRPC客户端，相同事件和快照、期限Stop、重复不扣量、账户隔离及实际服务重启数量2和第五槽恢复。
- invincibility-effect.json：原树对照、四条带/三纹理、实际生产几何与挂点、Sound0无声音、原通知29+1及300步、显式Stop/角色离场/对局清理。
- browser-invincibility.json：双方实际1920×1080/scale1页面、真实GPU提交、九个期限前持续样本、同事件/同tick同步、重复拒绝、到期零树/声音、双方离场清理，实际服务器重启后普通库存页数量2及第五槽77恢复。PNG捕获处理延后到期观察约16.7秒，仅记录观察延迟，不能作为效果寿命测量。真实期限Stop由network测试验证。
- 统一回归：治疗与攻击饮料自然对局、编译账户/迷彩实际网络保存重启、CPU五模式各两局、237正式可达模块边界、全仓类型及客户端/服务端独立构建全部通过，日志invincibility-{healing-regression,drink-regression,compiled-regression,boundaries,types,build-server,build-web}.log。攻击饮料旧夹具更新为统计自主及手动实际用量，保留有限库存/再战不补量要求。

M4-10-I08已原位勾选；完整原FuncType6与M4父项保留未完成。

运行：npm run test:combat:invincibility；npm run test:combat:invincibility:browser。普通开发服务3001/5173不被独立验收占用。

## 自主无敌防护（M4-10-I08-AI）

本人正常开启Autopilot或CPU在自然受伤至生命不超过50%，且300原世界单位内存在存活可攻击敌人时，使用当前已分配库存中的物件8。阈值和威胁检测均为明确重建AI策略；团队模式沿既有敌我筛选，混战模式按其他存活角色筛选。控制器最终普通输入的优先顺序为治疗、无敌防护、就绪开火攻击饮料、有效移动速度饮料。无敌选择不改变生命/位置/炮弹/结算，只设置普通useItem槽号，既有原16槽/重建非叠加资格/持久CAS/10秒免伤完成作用。

没有附近威胁、尚未受伤到阈值、死亡、技能8已存在、16槽满、空量/未分配库存时不申请；初始库存显式提供，不向正式账户赠送。本人AI不能代替Ready或再战投票，控制隔离和低序号手动恢复沿既有链。

原Effect100及Sound0/双1080p/资源释放证据复用。本轮仅在既有invincibility-effect.cts追加两角色47/48同时保留技能8：Stop47后48的记录、duration10、同一实例与同一四网格保持，继续更新仍活跃，最终battle.clear释放（invincibility-effect.json overlappingRoles）。NullEngine证明身份隔离与几何生命周期，不声称像素或音频隔离（源技能8没有音频）。

验收命令test:cpu:invincibility；自然CPU/本人持久账户两局和真实两连接服务器重启证据分别由cpu-invincibility、invincibility-ai-world、invincibility-ai-network生成。自然CPU专项已PASS：6次自然半血/近敌触发、100次真实免伤及100次无命中奖励检查、6次期限Stop、24次自然死亡；库存各2→0、第二局不補回。本人持久账户两局3次CAS施放（首局2/次局1）、33次免伤和无命中奖励检查、16死亡15复活、3期限Stop、Store重开qty0/槽77、零量重入与seq1手动恢复通过（cpu-invincibility.json、invincibility-ai-world.json）。

相关AI治疗/攻击/速度与本人持久自主三道具回归、服务独立构建、编译账户迷彩网络重启及CPU五模式各两局、全仓类型与238运行边界通过（invincibility-ai-{healing-regression,attack-regression,speed-regression,account-healing-regression,account-attack-regression,account-speed-regression,build,compiled,types,boundaries}.log）。夹具类型收窄问题改用正式快照读取期限，生产数据写入顺序不变。

真实两连接3151网络已PASS（invincibility-ai-network.json）：普通托管自然受伤300→128触发8，首槽duration10，同tick229双方状态一致，真实CPU免伤事件、tick242生命仍128/期限不续，唯一份1→0、关托管低序号普通移动恢复、实际服务器重启qty0/槽77/位值/账户隔离。初验夹具未配置心跳被正常15秒关闭，补既有账户验收heartbeat后复验成功，不改变产品权限或时限。M4-10-I08-AI已原位勾选，原FuncType6及完整M4父项仍保持未完成。
