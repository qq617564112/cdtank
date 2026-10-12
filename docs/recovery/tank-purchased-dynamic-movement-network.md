# M2-03 正式取得角色动态OBB消费者

`tests/tank-purchased-dynamic-movement-network.cts`验证四个正常非VIP账户真实购买角色后的动态运动门禁。账户初始拥有与库存为空，仅profile资金100000为显式测试夹具；TankShop BUY3、PetShop BUY2、SelectRole提供实际来源，没有导入拥有记录、位置、伤害或事件。旧购买和原参数向量直接复用，本片不重验交易完整规则。

## 来源与正式链

BUY/SelectRole→actual tank3/pet2、owned+34及真实技能字段→独立recoveredMovement→`originalMovementParameters`→`predictControlledBattleMovement`→原OBB预测与controller→权威姿态提交/双端快照。

原433073按forward重建OBB，构造尺寸49×24×52；原433d1c无NAV预测并限dt至float32(.2)，原4272d7检测其他存活角色的预测OBB，拒绝动态重叠；原426b92处理首个出生重叠。本片复用movement-obb/module与separation的有效原执行证据，未再次执行EXE。当前房间成员顺序、权威出生/分离接入、OS随机时钟替代、Y贴地与A/D控制映射为既有重建政策；最终车型尺寸及原完整入场顺序尚未恢复。

该组合实际统一参数speed130、turn0.6806783676147461。购入+34=0仍为重建初值，所选pet不当boundGear，不称完整原默认绑定。隔离副本只读取公开快照和真实购买参数，分别调用NAV-only及动态预测，辨别拒绝来自动态角色而非静态墙；其数值受快照角度/位置量化影响，不作为新增原oracle或精确位置对照。

## 首次真实双端范围

原始证据：`recovery/output/tank-purchased-dynamic-movement-network-2026-10-04T18-23-37-793Z.json`，状态PASS_PURCHASED_DYNAMIC_MOVEMENT；同名log。一个合法mode5/map20房，四名普通玩家均tank3/pet2。

- 原重复出生点的P1/P4入场后X相差60，分别为−244.71与−304.71，Z均−1119.34。
- 普通车体转向接近另一角色的朝向，第16tick隔离预测NAV允许约0.03403rad转角，动态预测command0；真实持续同输入后第19–26tick的X/Z/yaw/bodyYaw全不变。
- 普通move−1、turn0、aim1、firetrue随后倒退64.995558单位，10tick为0.5模拟秒，server与接收wall均0.5秒；独立炮塔转动与本人2001实际fire有效。
- 36个共同PLAYING tick的全players双端相同；4次正常Leave成功，服务进程与临时库清理完成。

本次动态拒绝发生在静止车体转向阶段，没有前进至接触点；因此只接受正式取得角色的出生分离、动态转向拒绝、倒退脱离和独立aim/fire，不扩大为前进碰撞、所有车型、全静态通知或完整动态运动规则。模拟tick为50ms，serverTime与接收墙钟分别记录。

专属strict NodeNext类型检查最终exit0，日志`tank-purchased-dynamic-movement-types-final.log`。主线审查与tasklist原位登记仍使用M2-03，父项保持未完成。

## 普通前进预测拒绝首次补充

`node --import tsx tests/tank-purchased-dynamic-movement-network.cts --forward-only`只补首次未覆盖前进输入，旧车体转向拒绝段直接引用。原始证据`recovery/output/tank-purchased-dynamic-movement-network-2026-10-04T18-26-26-781Z.json`为PASS_PURCHASED_DYNAMIC_FORWARD_CONTACT，名称中的contact指接近输入遇预测门禁，并不表示当前车体已重叠。

同一必要真实取得流程后，普通move1先从tick1至21离开近点：P1由(−244.71,−1119.34)至(−182.96,−1012.39)，P4仍(−304.71,−1119.34)。正常turn输入完成对齐，然后move1/turn0接近静车。第118tick隔离NAV-only预测下一步约6.499968单位，动态预测command0、位置不变；实际持续前进后的tick121–128均(−241.20,−1064.26)，车体方向也不变。随后move−1/turn0/aim1/firetrue倒退65.003487单位，10tick=.5模拟秒、.5服务秒、.474接收墙钟秒，独立炮塔与本人2001实际fire通过。137共同PLAYING tick全players双端一致，4正常Leave及service/tmp清理完成。

本补充证明真实取得角色的普通前进经原预测OBB提前拒绝，并可正常倒退脱离；不声明当前OBB发生实体重叠、精确接触距离、原最终车型尺寸或所有场景可达性。专属修改后的strict类型检查exit0，日志`tank-purchased-dynamic-forward-types.log`；旧转向首房未复跑，没有生产代码修改。
