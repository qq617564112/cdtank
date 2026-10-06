# M2-01/M2-03 独立运动计算资格

`roles/recompute-movement.ts`只消费实际坦克/宠物定义、明确owned战车+34、实际技能来源、getter9计数、原限制表与原运动倍率。HP、Critical、Lucky、Atk/Def及Bonus不属于运动依赖。完整433466与独立运动入口共用同一初始化、六项技能累加、移动转向限幅及精通转换，不另造公式。

`recomputeQualifiedRoleMovement`输入中的`ownedField34`允许明确undefined，缺失时拒绝；当前16技能槽缺失或TankType不在1～4也拒绝。接口不推断宠物绑定，不补0记录。既有`recomputeRoleMovement`从实际equipment提取+34后委托；它不再读取无关生命/攻防字段。

## 原直接来源与依赖

| 入口/字段 | 已确认执行 |
| --- | --- |
| tank loader43b62a | TankType→tank+50，TankMove→+84，TankTurn→+88 |
| pet loader43a91c | 四精通→pet+7c/+80/+84/+88；pet1均3 |
| 4334e8–4335b2 | 初始化六栈累加量：move、turn、四精通 |
| 4335b5–4337d7 /432b29/432fe8 | 16当前槽、独立role+a0六组技能ID/等级、额外技能及实际item source；baseId+rank−1，原被动资格与重复排除同一selector |
| 432951 | ItemMove/ItemTurn与四Mastery各自int32 imul再int32加；type14为getter9−FuncZ1正差倍率，其余1 |
| 4337d7–433ad6 | datascale14/15分别限制移动/转向合成值1～17，先上界再下界 |
| 433ad6–433c55 | 明确owned+34=0才四精通−1，最低1；按TankType选择对应有效精通 |
| 原61e494/61e498 | move scale10；turn scale f32(0.06981316953897476)；原f32基准0.1919862弧度 |

移动为`f32((有效精通+限幅合成移动−3)×f32(10)+50)`，原运动坐标单位/秒。转向为`f32((有效精通+限幅合成转向−3)×f32(4π/180)+f32(.1919862))`弧度/秒，保持原整数中间值与浮点保存时序。11度基准的原f32常数不能任意替换后统一舍入。

技能10151四精通各+1且满足原被动筛选。只有实际来源绑定且正确等级解析后才能贡献；84条件向量中的drivingBound=true是显式资格条件，不是选阿呆自动生效政策。owned+34购入写0仍为既有重建购入政策，原生产语义与初值未知，不称原版默认。

## 正式接线与具体缺口

主线attributes在完整HP/攻防字段门禁前，根据实际tables tank/pet、equipment明确+34/+58/+5c/+60与角色currentSkills/fields构造真实sources，成功后发布recoveredMovement；VIP生命尾项独立。所有其他权威输入/动态运动/控制及同步模块归主线，本片不改变按键或坐标映射。

| 未完成层 | 已确认链/字段 | 下一缺失入口 |
| --- | --- | --- |
| 新账户合法取得 | AccountStore.open只建accounts；TankShop/PetShop BUY创建role_records，SelectRole写profile+a8/+a4，accountBattleBinding→selectedRoleSources→BattleRoleSources→tables | 原新账户资金/profile与零价tank1/pet1取得producer尚缺；不授予starter，不以拥有记录fixture替代购买 |
| 独立宠物技能绑定 | 422f66/3aa5写manager+20/+24；4264c4写record+2a0、pet/tank定义+2a4/+2a8；4227d8/4335b5读role+a0；六组技能+44..+58和等级+5c..+70 | 正常选pet/开局实际caller向角色+a0赋值仍缺，已两次无推进停止扫描；selected pet不直接当boundGear |
| 原购入条件 | 原421ec2空构造清+34；421afe/3aa5 reader覆盖其uint32；433ad6消费者据0减四精通最低1。正式TankShop新BUY显式+34=0；TankPartSlot复制新购+6c，421cbe读取槽数 | 原服务器购入消息producer写+34的值/业务名称及+6c复制入口缺失；原客户端清0不证明服务器初值。当前两字段为明确重建，旧账户/receipt不迁移；只在取得新购原消息或server生产入口后续查 |
| 输入映射 | A/D普通turn→stationary body pose；方向键aim→独立炮塔，二者消费recovered turn | 原独立炮塔控制caller未取得；两类键盘控制为明确重建，不改现按键 |
| 原客户端测量 | 原函数向量已有，正式Node普通输入测量见专属network | 原Windows正常行为测量/误差没有取得，不能把x86函数执行当客户端实测 |

没有所选pet或owned+34的普通新Account/CPU仍不能发布原运动资格；本片不把缺失宠物当阿呆，不以fallback速度冒完整默认配装。攻防及生命已发布独立资格，完整伤害公式仍未恢复。

## 必要局部检查

tests/tank-movement-qualification.cts对照既有role-recompute-native.json的563原运动向量和1原拒绝，21车型×明确+34=0/1×条件bound10151缺/有共84组合通过。原缺+34、缺currentSkillIds、无效TankType拒绝；旧运动入口读取HP/armor会直接失败的专属检查通过，证明其不再依赖这些字段。

共用抽取影响完整重算，故本轮重新对照原564全重算/通知/dirty、254缺源保留和758精通/攻防原向量；全部通过。严格独立类型通过。没有重执行原EXE，不重跑已过弹药、五模式、图声或账户重启。

```sh
npx tsx tests/tank-movement-qualification.cts
npx tsx recovery/evidence/attributes/role-recompute.cts
npx tsx recovery/evidence/attributes/role-recompute-mastery.cts
npx tsc --noEmit --strict --skipLibCheck --target ES2022 --module NodeNext --moduleResolution NodeNext --esModuleInterop tests/tank-movement-qualification.cts
```

证据tank-movement-qualification.json/.log、-full.log、-mastery.log、-types.log。M2-01/M2-03原位登记独立运动资格及对应原/条件范围，父项保持未勾；模块PASS不代替正式购买、输入与双端验收。

## 正式购买双端运动验收

`tank-purchased-movement-network-2026-10-04T16-14-09-828Z.json`通过：四个真实新Account拥有/库存均空，仅主玩家profile明确给100000测试资金，其余初值未确认；TankShop BUY tank3游骑兵2500、PetShop BUY pet2大麦3500，余额97500→94000，SelectRole选择两实际实例。mode3/map7主玩家VIP，服务器使用所选tank3而非CreateRoom请求tank1。普通PlayerInput产生运动，两连接71个共同tick全部玩家快照一致，四客户端正常Leave。没有导入拥有记录或注入活跃位置/生命/事件。

此组合未绑定宠物驾驶技能；实际购入+34=0为重建初值。统一规则期望速度130原坐标单位/秒，转向0.6806783676147461弧度/秒。两类控制映射为重建，Node协议普通输入不称Chromium键盘验收。

| 输入 | 距离 | 车体角度rad | 炮塔角度rad | 模拟秒 | 服务端秒 | 接收墙钟秒 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| forward | 52.008080 | 0.000000 | 0.000000 | 0.400 | 0.405 | 0.395 |
| reverse | 52.001108 | 0.000000 | 0.000000 | 0.400 | 0.418 | 0.419 |
| bodyRight | 0.000000 | 0.272300 | 0.000000 | 0.400 | 0.411 | 0.413 |
| bodyLeft | 0.000000 | -0.272300 | 0.000000 | 0.400 | 0.412 | 0.416 |
| turretRight | 0.000000 | 0.000000 | 0.272200 | 0.400 | 0.406 | 0.408 |
| turretLeft | 0.000000 | 0.000000 | -0.272300 | 0.400 | 0.407 | 0.410 |
| stop | 0.000000 | 0.000000 | 0.000000 | 0.400 | 0.405 | 0.403 |

前进/倒退实际速度130.020201/130.002770，误差来自快照坐标小数舍入，容差0.3单位/秒；车体及炮塔角速度绝对误差小于0.002弧度/秒。炮塔左右输入车体角度均0；停止三项均0。模拟tick固定0.05秒，仅模拟量用于公式断言，服务端与墙钟独立保留，不宣称实时精确性能。

## 独立稀疏来源资格断言

`tests/tank-movement-sparse-qualification.cts`取上述购买记录作本地复制，normal/VIP分别移除HP、armor、二者、+34、pet、item来源，共12项PASS，严格类型PASS。缺生命/攻防时attributesReady=false且HP不改，magazineReady仍为true，运动仍130/.680678；缺+34/pet/item来源时拒绝运动，其中装备存在但缺少`0x58`/item source时同步拒绝弹药资格。没有将稀疏记录写入Account或活跃对局，证明的是正式重算函数资格支路，不能称稀疏普通账户联机。

汇总索引`tank-movement-player-accepted.json`仅以上范围。父项仍缺全部车型实际运动、阿呆合法取得/独立绑定、原新账户初值与原客户端行为测量。

## 普通非VIP正式购买运动首验

`tank-purchased-normal-movement-network-2026-10-04T16-21-36-152Z.json`通过：第三入场真实新Account在空拥有/空库存起点，仅profile资金100000；TankShop tank104勇虎与PetShop pet3均由BUY产实际实例，SelectRole后mode3/map7普通非VIP身份实际tank104/pet3，71共同tick双端玩家快照一致，四玩家正常Leave。没有赠予拥有记录或假设boundGear。原正价与表字段按实际来源消费，购入+34=0与资金profile初值明确为重建/测试范围。

原统一计算期望60单位/秒和0.4712388813495636弧度/秒：

| 输入 | 距离 | 车体rad | 炮塔rad | 模拟秒 | 服务端秒 | 墙钟秒 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| forward | 24.000832 | 0.000000 | 0.000000 | 0.400 | 0.402 | 0.401 |
| reverse | 24.002816 | 0.000000 | 0.000000 | 0.400 | 0.402 | 0.402 |
| bodyRight | 0.000000 | 0.188500 | 0.000000 | 0.400 | 0.402 | 0.402 |
| bodyLeft | 0.000000 | -0.188500 | 0.000000 | 0.400 | 0.401 | 0.401 |
| turretRight | 0.000000 | 0.000000 | 0.188500 | 0.400 | 0.401 | 0.403 |
| turretLeft | 0.000000 | 0.000000 | -0.188500 | 0.400 | 0.403 | 0.403 |
| stop | 0.000000 | 0.000000 | 0.000000 | 0.400 | 0.402 | 0.402 |

前进/倒退投影符号与输入一致，速度60.002081/60.007040，容差0.3单位/秒；左右两类转向分别确认有符号角度，角速度0.47125与期望误差小于0.002，炮塔输入车体不转，停止距离/两角0。scope仅此实际组合，其他运动来源及父项不勾。专属normal runner strict类型通过。首次未覆盖非VIP的raw保留于索引，不作验收通过证据。

## 中型Type2正式购买运动首验

`tank-purchased-medium-movement-network-2026-10-04T16-32-20-955Z.json`PASS、strict类型PASS。真实新账户初始零拥有/零库存，仅第三账户资金profile100000夹具；实际tank52 BUY4000、pet4 BUY4500，余额96000→91500，SelectRole两实际实例，mode3/map7普通非VIP玩家使用tank52/pet4。确认实际TankType2、owned+34=0、未绑定boundGear；统一公式读取第二精通分量，期望速度90、转向0.6806783676147461。

| 输入 | 距离 | 车体rad | 炮塔rad | 模拟秒 | 服务端秒 | 墙钟秒 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| forward | 36.001232 | 0.000000 | 0.000000 | 0.400 | 0.403 | 0.403 |
| reverse | 36.003221 | 0.000000 | 0.000000 | 0.400 | 0.400 | 0.401 |
| bodyRight | 0.000000 | 0.272300 | 0.000000 | 0.400 | 0.403 | 0.406 |
| bodyLeft | 0.000000 | -0.272200 | 0.000000 | 0.400 | 0.401 | 0.401 |
| turretRight | 0.000000 | 0.000000 | 0.272200 | 0.400 | 0.402 | 0.401 |
| turretLeft | 0.000000 | 0.000000 | -0.272300 | 0.400 | 0.403 | 0.403 |
| stop | 0.000000 | 0.000000 | 0.000000 | 0.400 | 0.402 | 0.402 |

前后有符号投影符合输入，速度误差<0.3单位/秒、两类有符号角速误差<0.002弧度/秒，炮塔输入车体不转、stop三项0；两连接71共同tick玩家一致，四正常Leave/cleanup。仅该组合及重建购入/控制条件，不能称全部车型配装或原客户端行为。

## 突击炮Type4正式购买运动首验

`tank-purchased-artillery-movement-network-2026-10-04T16-33-40-134Z.json`PASS、strict类型PASS。初始零拥有/零库存的普通第三Account仅profile100000测试资金，TankShop BUY tank1524000、PetShop BUY pet55000→余额96000→91000，SelectRole实际两实例；mode3/map7实际非VIP tank152/pet5，确认TankType4/+34=0/未绑定boundGear。原统一公式选择第四精通分量，期望速度90、转向0.40142571926116943。

| 输入 | 距离 | 车体rad | 炮塔rad | 模拟秒 | 服务端秒 | 墙钟秒 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| forward | 36.001232 | 0.000000 | 0.000000 | 0.400 | 0.415 | 0.412 |
| reverse | 36.003221 | 0.000000 | 0.000000 | 0.400 | 0.415 | 0.410 |
| bodyRight | 0.000000 | 0.160600 | 0.000000 | 0.400 | 0.411 | 0.406 |
| bodyLeft | 0.000000 | -0.160500 | 0.000000 | 0.400 | 0.406 | 0.401 |
| turretRight | 0.000000 | 0.000000 | 0.160600 | 0.400 | 0.414 | 0.414 |
| turretLeft | 0.000000 | 0.000000 | -0.160600 | 0.400 | 0.404 | 0.405 |
| stop | 0.000000 | 0.000000 | 0.000000 | 0.400 | 0.419 | 0.419 |

前后投影符号符合输入，速度误差<0.3单位/秒；车体/炮塔两方向角速误差<0.002弧度/秒，炮塔输入车体不转，停止距离/两角0。71共同tick双端全players一致，四正常Leave与临时server/db清理。源TankType4精通链和现有A/D、箭头同转速参数映射分开登记，后者为重建，不声称原独立炮塔控制。

现正式购买运动证据仅四个明确组合：tank3/pet2 Type1 VIP、tank52/pet4 Type2 normal、tank104/pet3 Type3 normal、tank152/pet5 Type4 normal。原21车84条件向量仍是模块证据，不能据四种分量路径宣称全部21车/装备/宠物真实运动。四组合均明确owned+34=0且未绑定宠物技能，未知原购入初值与role+a0绑定未恢复。

## 其余正价车型首次正式运动验收

`tests/tank-purchased-remaining-movement-network.cts`仅补tank53/54/102/154/155，均真实新Account BUY→SelectRole tank+pet2，普通非VIP mode3/map7。初始零拥有/零库存，只有资金profile100000测试夹具；所有拥有来源由正式交易创建，明确+34=0重建、未绑定boundGear，统一公式读各实际TankMove/TankTurn/TankType与pet2精通和实际技能/item源。严格类型通过，每房两端71共同tick全players一致，四正常Leave与独立server/tmp cleanup。

| tank | 公式速度 | 公式转速rad/s | 前距离 | 后距离 | body右/左rad | turret右/左rad | 模拟秒/段 |
| --- | ---: | ---: | ---: | ---: | --- | --- | ---: |
| 102 | 70 | 0.6806783676 | 28.001628 | 28.001628 | 0.272300/-0.272200 | 0.272200/-0.272300 | 0.400 |
| 154 | 60 | 0.2617993653 | 24.000832 | 24.002816 | 0.104800/-0.104700 | 0.104700/-0.104700 | 0.400 |
| 155 | 110 | 0.2617993653 | 44.000836 | 44.002827 | 0.104800/-0.104700 | 0.104700/-0.104700 | 0.400 |
| 53 | 120 | 0.6108652353 | 48.003624 | 48.003624 | 0.244400/-0.244300 | 0.244300/-0.244300 | 0.400 |
| 54 | 110 | 0.6108652353 | 44.000836 | 44.002827 | 0.244400/-0.244300 | 0.244300/-0.244300 | 0.400 |

每段独立serverSeconds/wallSeconds与原samples均在raw及索引保留，未把固定tick秒当墙钟。前后投影方向、速度误差<0.3单位/秒、两类有符号转速误差<0.002弧度/秒、炮塔段车体0和stop三项0均通过。

| tank | PASS raw |
| --- | --- |
| 102 | tank-purchased-remaining-movement-network-102-2026-10-04T16-36-53-819Z.json |
| 154 | tank-purchased-remaining-movement-network-154-2026-10-04T16-36-15-082Z.json |
| 155 | tank-purchased-remaining-movement-network-155-2026-10-04T16-36-20-434Z.json |
| 53 | tank-purchased-remaining-movement-network-53-2026-10-04T16-36-04-582Z.json |
| 54 | tank-purchased-remaining-movement-network-54-2026-10-04T16-36-48-774Z.json |

54/102首次记录尚未进入运动测量，在首快照到达前验收函数读取snapshot失败；两个FAIL raw及首批log保留。仅针对等待条件修正后重验54/102，不重复已过53/154/155、native、I06/I07或完整build。

原tank4已有`tank-paid-accepted.json`的15-09-34网络及15-10-40网页核心购买/选用/前移/炮塔/开火/双端证据，相关来源与代码未变，引用其原范围。旧证据不含前后有符号完整四转向/stop组合，本片不扩大其断言。

正式取得尚缺tank1/2/51/101/103/105/151/153/156/157/158：当前tankshop原11行仅tank1零价、其余十正价；零价tank1原取得/赠送producer未追得，其他十不在该正式商品目录，缺其取得资格与生产消息。正式链应写equipment实例+1c、定义+24及明确+34，SelectRole→profile+a8→accountBattleBinding.ownedTank/roomTankId→selectedRoleSources→attributes→权威运动。后续待查入口为原免费/其他取得消息写入拥有manager和profile选择producer，不将表定义或装备fixture当正式拥有。现+34原写入口语义与role+a0独立技能绑定仍保留既有具体缺口，不第三次扫描。

索引remainingPaidNetworks仅五首验，不声称全部21车正式运动、所有配装或原Windows行为；M2父项仍未勾。

坦克4补充动作范围：`tank-purchased-remaining-movement-network-4-2026-10-04T16-35-57-487Z.json`保留并仅补旧证据没有覆盖的倒退、有符号车体左右/炮塔左右及stop。实际tank4/pet2原统一speed150/turn0.7504915595054626，两端71共同tick一致，动作及正常Leave/cleanup通过；购入/选用/网页绘制/保存完整业务仍引用既有tank-paid证据，不重复登记首次购买成果。索引tank4AdditionalActions明确该范围。
