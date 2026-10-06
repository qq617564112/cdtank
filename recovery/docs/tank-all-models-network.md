# 其余20车型拥有来源运动联机范围

M2-02 / M2-03。专属[driver](/workspace/cdtank/tests/tank-all-models-network.cts)与[准备来源](/workspace/cdtank/recovery/output/tank-all-models-network-preparation.json)，独立端口3618。坦克1复用14-34-12真实网络证据，其余20车型各一次双账户普通输入；单服务器顺序20个房间，每房仅两连接，总连接数40。

本片仅覆盖前进、倒退、车体左右转动、炮塔左右转动六窗口，同serverTime/room/round/phase/tick的完整snapshot及关键event双端一致，双方正常Leave。普通弹匣只读取初始投影，不开火：旧tank-other-models-ammo-network-15-55-25-analysis和tank-three-models-ammo-realtime-network-21-36-12原弹药实际范围直接复用，不重复连续开火或补弹。

预服务创建40个账户，每账户导入完整21辆战车和Pet1，无金钱、库存或装备。拥有记录仅复用world-role-attributes-native的完整字段keys：其余值中性0，宠物身份73/定义1与HP600/Critical5/Lucky10取PetTable；六技能ID与rank保持0，与已收Tank1基线一致。战车各有独立实例100起、定义ID、原TankAtk/AtkBonus/Def/DefBonus/PartSlot，期限+34为0。profile全部0，随后通过正式SelectRole选择，再Create/Join/Ready。此为明确原表/decoder布局夹具，不冒购买、初始期限或成长取得。

独立oracle复用tank-ammo-authority-sol已接受21车输出，并用当前原TankTable、Pet1及DataScale14/15核来源：零期限四类精通各减1、下限1后按TankType选择；速度float32((精通+限幅Move−3)×10+50)，转速按原float32常量与顺序转换。每个窗口分别保存tick模拟秒、serverTime秒、墙钟秒与距离/转角。坐标0.01和角度0.0001快照精度允许速度误差<0.3、角速度误差<0.002；倒退另核投影符号，炮塔输入另核车体不变。NAV拒绝不被当作符合速度测量，失败原样保存。

只使用scripts/start-server.mjs已有compiled工程。实际运行需主线release，driver需TANK_ALL_MODELS_PORT=3618与TANK_ALL_MODELS_RELEASE=1。finally断连、停服、原生备份、0600身份保存及临时目录清理。唯一actual68635退出0，完整原raw与原生备份已保存、finally清理true且亲3618为空。

专属最终types43774退出0，prepare命令退出0并保存完整fixture字段与独立oracle。车体角度必须实际存在bodyYaw数值；仪器不以look yaw补缺。compiled1718既有工程release后唯一网络first已完成。

原服务端弹药/绑定producer、Windows行为测量与完整21车全部修正父项保持未完成。A/D车体与Arrow炮塔操作映射保留现明示Web重建，本片不改生产公式、协议、地图或生命周期。

[实际原raw](/workspace/cdtank/recovery/output/tank-all-models-network-2026-10-05T20-48-57-624Z.json)与[结果索引](/workspace/cdtank/recovery/output/tank-all-models-network-analysis.json)：20个指定车型六窗口全部通过，共120窗口、1019唯一共同完整snapshot、40正常Leave、0fire。原raw同时保存各端全帧与events，独立模拟/server/墙钟时基与完整fixture可复核；mainReview已有限接受。该片补齐Pet1中性拥有来源的其余20车型运动联机范围，不扩大到所有宠物/装备修正或原Windows客户端行为。

[独立主审](/workspace/cdtank/recovery/output/tank-all-models-network-root-review.json)：`PASS_FINITE_REMAINING20_OWNED_TANK_MOVEMENT_TURN_DUAL_SNAPSHOT_LEAVE_SCOPE`。Leave前1019共同完整snapshot、全部已捕获1020共同snapshot分别核定，40Leave；最大速度误差0.03358773、转速误差0.000279194。checkpoint512000字节/身份0600/3618空已核。
