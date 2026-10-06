# 战斗字段接入清单

源：recovery/output/verified/tables。正式数值入口为 `battle/attributes.ts`、`battle/roles/recompute-{movement,ammo,armor,life}.ts`，执行入口为 `battle/actors.ts` 与 `world.ts`；字段名和值来自原表。具体任务状态以 `tasklist.md` 为准，完整原权威仍未恢复。

## 战车（21条）

| 原字段 | 源值范围/样例 | 当前应用 |
| --- | --- | --- |
| ID | 1–158 | 战车选择/配置ID |
| TankName | 小勇士 / 小旅鼠 / 游骑兵 / 飞毛腿 / 尖嘴蚊 / 猎豹 / 大眼蟹 / 铁爪 / 大饭锅 / 拖拉酷 / 螺丝帽 / 勇虎 / 猛虎王 / 鋼牙豹 / 大钢炮 / 猛玛 / 神犀 / 小甲虫 | 显示名称 |
| TankInfo | 原描述文本 | TankShop目录/正式描述 |
| TankMoney | 0–7000 | 当前购价消费独立Tankshop金钱价；不将此列冒称BUY价格producer |
| TankCoin | 0–700 | 当前显示消费独立Tankshop代币价；不将此列冒称交易资格 |
| TankType | 1–4 | 原有效精通分量选择、统一重算及运动数学分支 |
| TankAtk | 100–240 | 购入owned攻击初值与原属性重算；实际弹丸伤害仍用明示原型加项 |
| MinAtkUp | 1–3 | 尚未接入 |
| MaxAtkUp | 3–6 | 尚未接入 |
| TankAtkBonus | 70–100 | 购入owned攻击加成初值及原属性重算；最终伤害消费者未恢复 |
| MinAtkBonusUp | 0–1 | 尚未接入 |
| MaxAtkBonusUp | 1–3 | 尚未接入 |
| TankDef | 15–25 | 购入owned防御初值及独立防御重算；缺生命来源才保留原型HP fallback |
| MinDefUp | 1–1 | 尚未接入 |
| MaxDefUp | 2–3 | 尚未接入 |
| TankDefBonus | 26–70 | 购入owned防御加成初值及独立防御重算；实际缓伤合成仍为重建 |
| MinDefBonusUp | 0–0 | 尚未接入 |
| MaxDefBonusUp | 1–3 | 尚未接入 |
| TankMove | 2–12 | 原ItemMove/精通/limits14合成与单位转换→recoveredMovement→正式运动；缺源保留原型fallback |
| TankTurn | 2–10 | 原ItemTurn/精通/limits15合成与单位转换；A/D车体和Arrow炮塔映射明确重建 |
| TankDelay | -4–6 | 实际tank reloadDuration→统一技能累加/limits16/原转换→普通及特殊装填期限 |
| TankBullet | 0–3 | 实际tank field90→统一技能累加/limits17→magazineReady容量与普通消费/补弹 |
| TankMarkNum | 1–1 | 尚未接入 |
| TankPartSlot | 1–3 | TankShop购入owned容量初值、正式Equipment槽容量及实际部件来源 |
| PetSizeLimit | 0–0 | 尚未接入 |
| PetTypeLimit | 0–0 | 尚未接入 |
| SideDef | 30–70 | 配置已读取，未进入伤害 |
| BackDef | 10–50 | 配置已读取，未进入伤害 |
| Hat | 1–1 | 尚未接入 |
| Balloon | 1–1 | 尚未接入 |

21车普通2001统一容量/间隔/末发装填已接正式多人对局，索引 `tank-ammo-player-accepted.json`；四TankType正式购买运动路径见 `tank-movement-qualification.md`。特殊切换、库存消费和生命周期范围按各自实际证据登记，不能从普通弹药覆盖推定完整配装。

正常生命采用实际owned pet+2c与已生效MaxHP技能；独立lifeReady优先于完整属性资格。VIP生命沿现模式重建规则，原倍率未恢复。购入owned初值、普通弹匣配给、弹丸伤害/flight和3秒复活仍需区分重建与原来源。原49×52运动OBB/NAV和动态运动门禁已接，不把原型弹丸身体半径20称为原运动碰撞尺度。

## 技能（342条）与道具（204条）

skill包含TriggerType/Target/Range及三个Effect/Sound/Tag/Method槽，HP/MaxHP/HPRegainRate/HPDrain、攻防/移动/转向/装填/弹量等字段，以及三个FuncType/FuncT/FuncX/FuncY/FuncZ槽。当前普通开火以技能2001的源声音/头像引用接入；原效果、目标选择、函数分派、持续时间和所有技能行为未全量接入。

item包含ItemSkill1/2/3、BattleUseMax、Durable/Break、装备/交易/价格与资源引用。持久账户背包、七槽、普通useItem、已实现道具施放及库存CAS有限消费已进入World。饲料、饮料、注射、免伤、特殊弹药和3003/3004/3005等已交付范围见tasklist对应原位索引；不能将这些重建施放producer冒称原全部Func分派。Range及28个原数值属性已发布至共享目录，23非零FuncType逐槽范围见skill-function-coverage.md。

| 源资料 | 原字段直接证明 | 下一步所需行为证据 |
| --- | --- | --- |
| skill 1 宠物饲料 | HP=200、描述恢复生命200、FuncType1=2 | 实际200恢复、限幅和双端生命已接；原目标/施放authority仍缺 |
| item 1 宠物饲料 | ItemSkill1=1、BattleUseMax=10、Durable=10 | 正常BUY/配置/使用/CAS/两局与重启已验；原购买资格/消费producer及耐久语义仍缺 |
| tank攻击/防御/朝向防御 | 21条属性值与升级字段存在 | 普通命中、方向判定、随机/暴击/护甲/最终HP计算链 |

## 接入顺序

1. 恢复原动作播放4800时间单位/秒与MV3事件触发，接到真实开火/死亡/挂点。
2. 原普通命中及HP/装填公式，替换有明确原指令证据的原型参数。
3. 原道具技能函数分派与库存来源，接通背包、使用、消耗和持续效果。

完整原账号、装备与成长数据也必须进入计算；只接一个技能不能代表全部战斗能力完成。

## 原生命赋值与通知顺序

原角色integer getter432417的selector15读取record+54，selector16读取record+58；433250的selector15是生命赋值入口。原调试文本427e69–427e89实际调用这两个getter，格式`Life : %d / %d`依次收到37/200，确认分别为当前生命/生命上限。没有把float getter10/11的相邻字段误当作生命。

共享`apps/shared/combat/role-health.ts`恢复完整selector15分支：没有role record时返回false且无通知；存在时保存旧signed32生命，将输入按signed32写入record+54，先通过record virtual+24通知12，然后按signed32比较依次限制下界0、上界record+58。role+b8观察者存在且最终生命与旧值不同，才调用其绑定对象virtual+8，参数为role、旧生命。成功赋值返回true，即使最终生命没有变化。通知12发生在限制前；原record virtual+24经521e8a进入管理器529a10，设置属性12的dirty位，不直接触发UI观察者。测试入口观察到此时的负值或超上限原输入；生命变化回调发生在限制后。这个函数没有自动切换死亡状态，也不更新生命上限。

`npm run test:combat:health`执行120组完整原setter/getter，覆盖无记录、有/无观察者、最大生命0/1/200、生命不变、低于0、超过上限及unsigned输入ffffffff按signed32成为-1。共享结果及每次通知时的记录逐值一致；原Life格式尾部实际执行，格式化库边界供给。证据role-health-native.json、role-health-suite.log、role-health-types.log。

该模块证明显式客户端生命赋值的合同；正常出生、伤害、治疗、复活现通过 `battle/health.ts` 发布唯一生命值，独立MaxHP合成见 `recompute-life.ts`。它们不能证明原FuncType2服务端目标/成功或最终伤害公式，FUNC-02/M1-09原父范围仍未完成。

## 原角色属性注册与直接生命写入

`tests/role-properties-native.py`执行完整角色记录构造523303、属性声明5221a0及真实属性管理器52b0a0。34个属性的注册、实例化、索引和绑定全部由原指令执行，仅供给operator new/free、HeapAlloc和退出析构调度。role-properties-native.json保存34项原名称、类别、数值type、索引、绑定偏移和实际虚表；不是从偏移推测字段名。

| 属性索引 | 原名称 | 记录偏移 | 注册类别/type |
| --- | --- | --- | --- |
| 9 | m_fVelocity | 48 | numeric/4 |
| 10 | m_fTurnVelocity | 4c | numeric/4 |
| 12 | m_iHP | 54 | numeric/5 |
| 13 | m_iMaxHP | 58 | numeric/5 |
| 14 | m_iTeamId | 5c | numeric/5 |
| 28 | m_arrayItemHotkey | 94 | array |
| 29 | m_arrayTankMark | b0 | array |
| 30 | m_arrayTankPart | bc | array |
| 31 | m_arraySkillTableId | d0 | array |
| 32 | m_arrayTexture | 110 | array |
| 33 | m_arrayActState | 11c | array |

原type5的大小表61f8a8+5为4。绑定值写入545d40从传入的两个DWORD取低四字节、直接复制到绑定字段；读取545c30返回该四字节与高DWORD0。HP和MaxHP各10次原写入/读取覆盖0/1/200/ffffffff/80000000及高DWORD0/11223344，共20例：相邻记录字节不变，负生命与超过最大生命的值在此层原样保存。原属性值写入不调用433250、没有上下限限制；外层网络传输仍需另行恢复；管理器接收及owner观察者转发见下文。

共享role-health.ts的applyRoleHealthProperty以原索引12/13分别写hp/maxHp，保留signed32位模式，与20例原绑定访问逐值一致。它与setRoleHp的显式赋值合同分开；不能在尚未确认的接收路径上统一强行限制。test:combat:health组合120个显式setter与20个属性写入通过，证据role-property-health-suite.log，类型检查role-property-health-types.log通过。网络外层路由及FuncType2的权威施放仍待实现。

## 原角色属性待同步标记

原记录构造与34属性注册后，record virtual+24的521e8a通过真实元数据管理器virtual+28调用529a10。管理器+40..+5c为8个DWORD、256个属性位；输入只读取低byte。普通索引按`word[index>>5] |= 1<<(index&31)`标记；fe设置全部8个DWORD为ffffffff，ff保留原位图。原fe循环最后一次eax=-1仍执行写入，因此包含+40。共享role-property-dirty.ts恢复此合同。

role-properties-native.py对零位图和已有标记位图执行全部256个byte索引，共512次真实记录通知。另执行120组完整433250生命setter，使用原523303构造、5221a0注册的记录及真实521e8a/529a10；仅生命观察者边界供给。有记录时，生命不变、负输入和超上限输入均标记bit12；无记录不标记。共享setter与dirty模块组合的最终记录、通知时刻、旧生命回调和位图均与原链逐值一致。

`npm run test:combat:health`通过；证据role-properties-native.json的dirtyRows/healthRows、role-property-dirty-suite.log，类型检查role-property-dirty-types.log通过。标记合同尚未接入World；socket层接收及服务端公式仍待恢复，M2-01与FUNC-02保持未勾选。

## 原属性变化检测与生命数据段

原529a60先通过管理器virtual+4读取+0c模式，仅模式1扫描。schemaMode+3c为2时，还要求8个dirty DWORD至少一位已置；否则返回false，原位图不变。满足入口条件后清空全部8个DWORD，按注册顺序扫描属性：类别1调用545eb0比较绑定值与快照，类别2/3调用原字符串比较，类别4调用5448e0比较整组绑定字节，类别5/6/7读取5407d0标记。仅比较返回AL=1时置对应位；最终位图非空才返回true。检测不刷新快照，也不把此前置位直接当作值已改变。schemaMode2下，无dirty位即使值已改变也不会进入扫描。

共享role-property-dirty.ts恢复入口、扫描、位图与返回合同；rolePropertyBytesChanged恢复原数值/数值数组绑定字节比较。tests/role-properties-native.py执行完整529a60与全部34个真实属性比较器，覆盖模式0/1/2、schemaMode1/2、无待同步位/HP位/最高位、逐数值和数组末byte变动、HP与MaxHP联合变化及不变值，共630组。共享比较访问顺序、返回值与位图逐组一致；原快照保持不变。昵称使用原构造的空字符串与空快照，未验证字符串变更；类别5/6/7未由本角色schema覆盖。

原529ba0数值发送分支529cdd调用545f10；实际执行其53d680、53d7a0、53d720及53fe50缓冲操作，恢复HP/MaxHP的8字节属性段：类别byte1、索引byte12/13、长度uint16大端4、值signed32大端。37的HP段为`01 0c 00 04 00 00 00 25`。共享role-health.ts的encodeRoleHealthProperty与14组原段逐byte一致，覆盖0/1/37/200/ffffffff/80000000/12345678。此段不是完整原网络包。

原数值发送分支529d67调用545ee0复制绑定值到快照；14组执行确认刷新后的545eb0返回false。原检测阶段不复制，发送阶段才复制。此处执行段编码与刷新函数，尚未执行整个529ba0外层网络封装。Winsock htons边界供给，原数组/字符串段另行恢复；生命属性接收见下文。

验证：npm run test:combat:health通过；role-properties-native.json的detectRows/wireRows记录原执行，role-property-detection-suite.log记录共享对照，role-property-detection-types.log记录类型检查。World尚未接入该原属性发送链；M2-01、FUNC-02保持未勾选。

## 原生命属性接收与观察者转发

原属性管理器52a280先读取owner记录的元数据类型，和消息header+4经53d440得到的类型比较。header+1f为byte段数。每段由真实53dbd0读类别、索引、大端长度及payload，再通过528d10按低byte索引查已注册字段。类别1要求目标字段virtual+c也为1，调用545ff0：核对段类别1与type5长度4后，经53d7e0/53fae0逆序读出大端值到绑定的HP/MaxHP地址。不调用433250，不限制0..MaxHP。

每个成功段随后通过管理器+60的真实52a8f0转发给owner virtual+48返回的观察者virtual+4，参数为owner记录、字段对象、原消息header+14经53d4a0读取的32位context。重复值仍转发；观察者缺省时仍正常写入。顺序按包中段顺序，每个回调看到该段已写入的状态。失败立即返回false；先前成功段及其通知保留，不回滚。该接收链不改dirty位图，也不刷新绑定快照。

tests/role-properties-native.py执行真实管理器52a280、原段解析53dbd0、原索引查找528d10、原数值读取545ff0及完整观察者转发52a8f0，42组覆盖有/无订阅者、两种生命字段的14种编码、生命负值/超上限、相同值、多段顺序、长度3、类别不匹配、缺失索引35及首段成功后第二段失败。共享receiveRoleHealthProperties恢复HP/MaxHP数值段子集，最终记录、成功返回、通知顺序和context逐值一致。

测试供给元数据类型getter、日志服务查找及日志级别、Winsock ntohl/ntohs和终端订阅者；packet容器由原53fd20构造并用原53fee0写入，接收游标设为已消费准备的32字节header。此证据覆盖属性管理器入口后的实际接收及通知，不覆盖socket到对象管理器的路由，不包含其他属性类别。原生命合成、伤害和FuncType2施放仍待恢复。

验证：npm run test:combat:health通过；role-properties-native.json的receiveRows、role-property-receive-suite.log与role-property-receive-types.log。M2-01及FUNC-02保持未勾选。

## 原对象登记表查找与属性命令路由

原管理器52af80从消息header+10经53d480读取uint32对象ID，先和manager+8比较。不同立即返回false。相同后经53d4d0读取header+1e的byte命令：3调用5285a0，5调用52a280属性接收，6/7/8/9调用528a50，其余返回false。被分派的命令统一返回true，忽略分支返回；命令5即使属性段解析失败也返回“已处理”。这不证明该属性已成功写入。

上游525630/525730/525830分别对登记表对象+8/+20/+14的树使用真实550b30按header+10对象ID查找。找不到返回false；找到后调用记录virtual+30取得16位记录类型，和header+c经53d460读出的uint16类型比较，不同返回false。通过后，记录virtual+10给出属性管理器，再进入52af80。三个登记表的业务含义尚未命名。

共享role-property-route.ts恢复对象ID/命令分派及登记表键/类型核对。58组真实52af80执行覆盖匹配/不匹配对象ID、命令0/3/4/5/6/7/8/9/10、完整生命属性段及部分成功后失败；命令5执行真实52a280接收，命令3和6..9仅供给处理器边界，不代表这些分支业务已恢复。48组上游执行覆盖三个登记表入口、键命中/缺失、类型匹配/不匹配、命令5/4、正常与第二段失败，继续执行真实52af80及生命属性接收链。共享返回、记录及通知一致。

48组登记表路由测试准备一个合法根节点及nil哨兵，并设置测试记录类型4321；执行真实查找，未执行登记表构造、插入、删除或类型工厂注册。网络header准备和日志/Winsock边界同前节；socket读取及socket到登记表入口的分派仍待恢复。没有把命令5分派成功当作技能施放成功。

验证：npm run test:combat:health通过；role-properties-native.json的routeRows/registryRows、role-property-route-suite.log，类型检查role-property-route-types.log通过。M2-01、FUNC-02保持未勾选。

## 原对象登记表构造、登记和移除

完整5275f0构造真实登记管理器，三棵树分别位于+8（总表）、+20（模式1）、+14（模式2），真实54ce80分配nil哨兵并设置空树头及计数。模式1入口528030调用记录virtual+4要求AL=1；模式2入口5280d0调用virtual+8要求AL=1。原角色记录的521e33/521e47分别比较管理器模式+0c是否1/2。

两种登记均先进入527e00，以记录virtual+c返回的对象键查总表。重复键拒绝且保留原表；新键由真实527930及红黑树插入写入总表，随后调用网络对象对应的登记事件536b70，再写模式分表。因此登记事件执行时，总表已经包含新记录，分表尚未包含。共享role-property-registry.ts恢复三表、登记门槛、重复拒绝与该顺序。

原526a70移除先查总表，调用网络移除事件536dc0；此时总表和分表仍保留记录。随后按记录的模式条件删除分表，通过真实5261f0/525b90及树删除移除总表，最后调用525030处理记录回收。共享unregisterRolePropertyRecord恢复移除事件、表删除和回收边界调用顺序。

原生测试使用真实5275f0、五个真实523303角色记录与5221a0属性构造，登记键73/12/200/55/101，混合模式1/2，逐记录重复登记，并按非插入顺序删除全部记录。15组操作对照实际树状态、计数和事件时刻；最后三表均空。原实际节点分配、树平衡及删除均执行，仅网络事件536b70/536dc0、网络参数getter及最终回收525030供给边界。未执行事件订阅者分派或记录的最终销毁。

在这批真实构造、插入后的表上，另执行总表及两个模式表的18组真实525630/525730/525830路由：五个已有键和缺失键999，通过真实52af80、52a280、原数值解析写入生命37→200。分表只允许对应模式记录命中；共享登记、路由与接收组合逐值一致。这批验证覆盖真实登记后的属性接收，不依赖上一节单节点准备树。

验证：npm run test:combat:health通过；role-properties-native.json的lifecycleRows/liveRouteRows、role-property-registry-suite.log，类型检查role-property-registry-types.log通过。事件订阅分派、最终对象回收、socket到登记表的消息入口及权威公式仍待恢复；M2-01、FUNC-02保持未勾选。

## 原登记网络事件的可选观察者转发

真实536b70与536dc0从网络事件对象+4读取单个可选观察者指针。为空时不转发；非空时分别调用观察者virtual+24及virtual+28，传入原网络对象、原记录及调用者供给的context。两函数不遍历观察者列表，不改登记表，不解析生命值。诊断日志不影响转发条件。共享role-property-events.ts的dispatchRolePropertyEvent恢复这两个转发入口。

role-properties-native.py在真实登记表构造及真实角色记录上重放15项登记/重复拒绝/移除操作，分别设置无观察者和有观察者，共30项。此次536b70/536dc0执行全部原函数，不供给替代函数；只供给末端观察者virtual+24/+28、日志服务及网络context getter，最终525030回收仍供给边界。每次观察者收到原网络对象、原记录和context abcdef；创建时总表含新记录、模式表未含，移除时两表仍含。无观察者时表操作不受影响，重复键不转发。

共享登记模块与dispatchRolePropertyEvent组合对照30项操作，返回值、三表状态及观察者参数/时刻一致。验证：npm run test:combat:health通过，role-properties-native.json的eventRows、role-property-events-suite.log；类型检查role-property-events-types.log通过。观察者指针的绑定入口、终端观察者业务及最终对象回收另行恢复，不把本层转发等同于完整订阅或socket链完成。M2-01、FUNC-02保持未勾选。

## 原模式1记录退役及属性清理

原525030先调用记录virtual+4；模式1记录进入真实管理器529480。按注册顺序对非空属性调用virtual+10(1)，再对第二成员向量调用virtual+14(1)；释放两个向量，清零起止/容量、索引byte+4/+5、网络+34、元数据+38及模式+0c，将对象ID+8设置ffffffff。owner+10、schemaMode+3c、dirty+40..+5c及内嵌观察者+60..+64保留；角色记录数值不变。共享role-property-cleanup.ts恢复这份清理合同。

tests/role-properties-native.py对三个真实模式1角色执行525030及529480，102个实际字段析构执行，观察原注册顺序及CRT释放，验证向量清空、路由状态重置及保留字段。这里只供给CRT free边界；没有用替代属性析构。共享清理与三组原状态和102个释放顺序一致。schema的第二成员向量为空，本批未覆盖非空第二向量的实际析构。

模式2的525030另外查类型工厂，再调用工厂返回函数；原角色回调及分派对照见下节。此清理不等于角色对象销毁，也不把dirty位图误清零。验证：npm run test:combat:health通过，role-properties-native.json的cleanupRows、role-property-cleanup-suite.log；类型检查role-property-cleanup-types.log通过。M2-01、FUNC-02保持未勾选。

## 原模式2类型工厂归还

525030对模式2记录读取virtual+30的uint16类型，经真实523cf0全局入口、523810工厂管理器getter及52be40索引查找24字节工厂项，调用项+10的cdecl归还函数。原角色工厂注册52278d明确登记回调447e29；此回调调用记录virtual+0(1)，实际522822及52215e等析构进一步释放属性管理器和字段。模式0返回true且不清理；缺失类型工厂返回false且不清理。

tests/role-properties-native.py准备单项工厂与已初始化全局指针，以原角色类型setter字段分别供给类型0和缺失类型2，真实执行525030及全部上述查找；正常类型调用原447e29与角色/属性管理器析构。记录、管理器及34个字段均发生CRT释放；仅CRT free与日志边界供给，未替代析构或工厂归还。三组状态覆盖模式0、模式2缺失工厂和模式2有效工厂。共享role-property-cleanup.ts的retireRolePropertyRecord按模式分派，与原返回及清理行为一致。

验证：npm run test:combat:health通过，role-properties-native.json的retirementRows/factoryReturn、role-property-factory-suite.log；类型检查role-property-factory-types.log通过。工厂初始化及类型注册未执行，不能认定整个原对象工厂已恢复；World对象生命周期接入与socket入口仍待完成。M2-01、FUNC-02保持未勾选。

## 原OdlPlayer类型注册与工厂创建生命周期

tests/role-properties-native.py执行真实类型工厂构造52c550及原角色静态注册52278d。服务注册523ab0实际调用工厂52c3b0，写入24字节类型条目，并通过原522781分配类型编号。本测试只有OdlPlayer一种类型，故编号0；这不是原完整程序的固定角色类型号。真实条目名称OdlPlayer，创建522748、归还447e29、类型赋值522781，均来自原注册而非手工填入。

原522748创建角色记录后，测试调用原5221a0声明34项属性；设置模式2、对象ID73及元数据边界，进入真实5280d0登记。生命包通过真实模式2登记表525830→52af80→52a280写37→200，再由真实526a70删除登记并经真实525030/52be40调用刚注册的447e29，释放角色、管理器及属性字段。最后三表均空。共享登记/生命接收/退役模块组合对照此链一致；共享测试的终端工厂释放用回调记录释放状态，原生测试实际执行析构。

本测试供给全局服务查找、元数据类型及日志/Winsock边界；执行真实服务注册方法和工厂构造/条目注册，但未执行完整服务单例初始化、全类型注册排序及工厂名称索引的后续初始化。角色schema仍通过原函数显式声明，尚未证明实际socket创建消息的调用顺序。验证：npm run test:combat:health通过，role-properties-native.json的registeredFactory、role-factory-registration-suite.log；类型检查role-factory-registration-types.log通过。M2-01、FUNC-02保持未勾选。

## 原完整创建消息与初始生命属性

真实528170按header+c读取记录类型、header+10读取对象键、header+4读取元数据类型。先向网络对象virtual+34查元数据，再经523cf0/523810/52be40查记录工厂，缺失任一项返回false。命中后调用工厂+c创建记录，调用记录virtual+40声明schema，取得属性管理器，设置对象键、模式2、网络和元数据指针，再经真实52af80分派消息。分派不支持的命令时调用工厂+10归还记录并返回false；命令分派成功则进入5280d0登记，外层返回true。

命令3由真实5285a0逐段查字段并读值，支持数值/字符串/数组等类别。与52a280更新不同，它不按每段向生命属性观察者转发，也不先核对owner元数据类型。生命数值经原545ff0直接写入，未经上下限限制。5285a0内部失败返回false，但52af80命令3分支仍返回true，528170因此仍登记该记录：不合法首段可留下构造的HP/MaxHP0；首段生命成功、第二段失败时保留首段值。

原生测试执行完整528170、真实注册的OdlPlayer工厂522748、原schema5221a0、真实5285a0/段解析、真实登记和最终526a70移除/工厂析构。六组覆盖正常生命及上限200、首段长度3、首段成功后第二段长度3、命令4、缺失工厂类型2、缺失网络元数据。共享role-property-registry.ts的createRolePropertyRecordFromMessage组合原路由和生命读取模块，与原返回、初始记录及最后空表状态一致。无需测试提前调用schema或设置HP。

仅网络元数据查找、诊断日志、网络锁/解锁与CRT/Winsock边界供给；没有替代角色创建、schema、初始数值接收、登记、删除或析构。socket报文到此入口的分派、其他初始属性类别及全类型工厂仍待恢复。验证：npm run test:combat:health通过；role-properties-native.json的creationRows、role-creation-message-suite.log，类型检查role-creation-message-types.log通过。M2-01、FUNC-02保持未勾选。

## 原对象消息上游类别与命令分派

真实5282e0先调用525520。消息header+1d类别byte必须为3；header+8收件人DWORD为fffffffe且header+1e命令5时，还要求对象键已存在于模式2表，否则不分派。其余符合类别的消息通过入口条件。

原跳转表5283ec按命令1..9分派：1→526c40、2直接返回true、3→528170创建、4→5272d0移除、5→525930模式2表、6→525950总表、7/8→525970模式1表、9→525930模式2表。其他命令返回false。共享role-object-dispatch.ts恢复入口与该跳转合同，各业务通过显式回调提供。

12组真实5282e0与525520执行覆盖类别2拒绝、命令0/10拒绝、命令2直接接受、缺失对象的fffffffe/命令5拒绝、空表命令6/7/8/9、命令3创建、已登记对象fffffffe/命令5更新、命令4移除。创建执行真实工厂/schema/初始属性，更新执行真实登记表路由/属性接收，移除执行真实5272d0类型/元数据核对及526a70删除/工厂析构。共享分派组合对照返回和三表状态一致。命令1业务、命令6..9已有对象的具体业务未由这批测试验收；socket读取与TCP组帧仍未覆盖；完整字节包容器及53ee60到5282e0的调用见下节。

验证：npm run test:combat:health通过；role-properties-native.json的dispatchRows、role-object-dispatch-suite.log，类型检查role-object-dispatch-types.log通过。M2-01与FUNC-02保持未勾选。

## 完整字节包容器与网络接收入口

原53d9c0调用53fd20构造缓冲区、53fee0复制完整字节包、53fbb0将读取游标推进32字节，再由53fb90将缓冲起点保存至对象+218。53fad0取得总长，减32后经htons写回header+2两字节；这一步按实际缓冲长度重写载荷长度，不证明输入头部长度经过验证。原始输入字节不变。6组原执行覆盖载荷0/8/16/255/256/520字节，拷贝字节、长度、头部重写及原输入逐项核对。共享readRoleNetworkMessage复制字节，按大端读取元数据类型、收件人、记录类型、对象ID、上下文及类别/命令/属性数，并给出32字节后的载荷。

真实53ee60读取header+8收件人。仅收件人为fffffffe时，通过network virtual+4c读取状态，状态必须等于3才继续；普通收件人不调用状态getter。随后按header+1d类别分派：1→539470、2→network virtual+10取得对象后550d50、3→network virtual+c取得登记表后5282e0，其他类别不分派。共享dispatchRoleNetworkMessage恢复这些调用条件，不定义原函数未明确承诺的统一布尔返回。

84组真实入口执行覆盖类别0/1/2/3/4、普通/特殊收件人和网络状态0/2/3/4；其中最后4组从原53d9c0完整字节包构造开始，实际创建OdlPlayer及34字段，状态2阻止特殊收件人生命更新，状态3允许原生命属性接收，随后执行真实移除和工厂归还。共享组合逐项对照状态getter调用、类别处理器调用、三张对象表和生命值。状态/登记表getter及类别1/2末端业务供给；类别3完整原对象链执行。类别1/2具体业务、TCP组帧、socket读取、完整服务初始化和FuncType2实际施放未验收；共享模块尚未接入World。

验证：npm run test:combat:health与npx tsc --noEmit通过；role-properties-native.json的packetRows/inletRows、role-network-inlet-suite.log、role-network-inlet-types.log。M2-01与FUNC-02仍未勾选。

## 原客户端技能选择与装填时间调用链

`npm run evidence:combat`从当前原EXE读取分支、getter跳转表和指令，输出`recovery/output/combat-client-evidence.json`；不改原文件或服务端公式。

- `0x428c55–0x428cc1`读取角色virtual+0x18整数getter11（0x432349，分支0x432398读取role+0x2a0记录+0x3c，原字段m_iCurrentBulletId）。选值0或1时派发默认物件ItemTableID2001；其他选值取得角色数组getter0，以`array[selection-2]`调用0x43d186，成功读取返回记录+0x0c传入物件回调，找不到数组／记录则不派发。选值为快捷槽，数组存库存实例ID；记录+0x0c为ItemTableID，物件2001的ItemSkill1/2为2001/4020。原成功使用后的数量更新与完整库存供给仍待恢复。
- `0x423092–0x42312d`仅当回调角色等于实例当前角色+0x3c时更新可用时间。virtual+0x18整数getter4读取记录+0x44（原字段m_iBullet），等于1时读取float getter23，其余读取getter24；getter表0x4322ab明确分别读取角色+0x54和+0x50。两个分支都计算`relativeClock + duration`，以f32写入角色+0x9c，并通过实例+0x7c回调发送所选duration。
- relativeClock函数0x422f0d调用0x40607b(globalGame+0x10)，再减实例double+0x30。技能与角色回调0x42312d–0x423146独立保留；装填时间不是从技能2001编号直接推导。

完整原4288fe自由瞄准分支已执行对照。入口按传入角色ID查对象，缺失或非本机直接返回；本机先经实际431dbf清flag12，再检查实际43293d状态2、全局阶段4、控制器存在与scene+60非零。436078/436fe0都不提供目标时进入自由分支。431fd2读取role+274朝向，431fe0读取role+25c位置；每个朝向分量乘EXE常数1000后先保存f32，再与位置相加保存f32。时间由相对double clock返回，再存f32。先经实际423956转发目标点到瞄准效果边界，再发送请求，最后派发默认物件2001的423092开火通知。

原425876构造message type3a9b，packet+c/+10/+14为目标点三个float，+18为相对时间float。原492a89写出四个原始32位float，4258b8按同序清零并读回，合计128位，LSB-first位流；24组真实writer/reader覆盖三组值与八种位对齐。768组完整4288fe覆盖角色有/无、本机/远端、四状态、三阶段、控制器/场景门禁、四弹量和三位置/朝向向量；请求、瞄准、通知顺序及flag12清理一致。整段执行保持完整角色记录不变，包含m_iBullet；不把原客户端请求当服务端成功或耗弹证据。

role-free-fire.ts恢复自由目标点、请求门禁/顺序与3a9b codec。World正常开火现通过createRoleFreeAim计算原f32目标点，再由目标方向驱动现有弹丸。普通转动瞄准/开火输入验证实际弹丸方向，读取未舍入权威姿态仅用于断言，不注入位置、伤害或结果；五模式CPU各两轮及原flag/deadline/死亡/复活/再战、126组World原属性/21战车开火回归通过。弹丸速度360、炮口30/20、寿命2.2与伤害仍是原型；实体目标分支4288fe→3a9d→423092已恢复240组完整原执行，role-entity-fire.ts的352位codec对照通过；状态快照尾部两float不入线路，解码显式保留，角色/库存数量不变，不能推出server耗弹。详见ammo-producer-sol.md。射击通知3ac7/3aa2的完整factory、32/144位codec与原动作分派见projectile-source-sol.md及role-shot-notify.ts；384原动作/6完成转发和416codec通过，仍未取得弹丸创建/轨迹参数。生产3a9b/3a9d通知与物件目标分支尚未接入，M2-02/M2-04保持未勾选。

验证：npm run test:combat:free-fire、npm run test:combat:state、npx tsx tests/world-role-attributes.cts、npm run test:cpu、npx tsc --noEmit。证据role-free-fire-native.json、role-free-fire-native.log、role-free-fire-suite.log、role-free-fire-aim-world.log、role-free-fire-state.log、role-free-fire-world.log、role-free-fire-cpu.log、role-free-fire-types.log。原执行供给阶段/角色/目标查询、时钟、瞄准效果末端、发送末端及423092末端；真实角色字段getter、flag12 setter、消息构造/析构、目标点计算及codec执行。已恢复的完整423092与属性来源见后文，真实耗弹/补弹与服务端伤害仍待完成。

## 角色装填重算与网络覆盖

已追踪的角色+0x2a8来源：网络角色建立0x426524–0x426539用消息+0x68作为key，通过0x413c95返回globalGame+0x114的+0x84管理器，调用0x411068查表并写入角色+0x2a8。0x43352f–0x43358e从该记录+0x8c复制基础值至角色+0x50，同时+0x54初始化为0。该管理器加载字符串tank的入口见0x41b8fb–0x41b947；记录构造、字段索引与TankDelay的最终对应仍需完整核对，不能只凭相同偏移认定。

角色重算还接受技能／装备累加。确定的技能段0x4329fd–0x432a2a以signed32 `record+0x124 * multiplier`加至角色+0x50，`record+0x12c * multiplier`加至+0x54。完整装备／技能数量和字段表映射尚未验证。

0x4338e7–0x4338fe将+0x50限制至不大于30（常数0x61e4fc），0x433a4b–0x433a62将其限制至不小于6（常数0x61e53c）。0x433cc9–0x433ce1计算：

- normalSeconds = f32(boundedBase × f32(0.1))。
- type1Seconds = f32((boundedBase × f32(0.1)) × accumulatedFactor × f32(0.03))。

第一处fst保存normalSeconds为f32但没有弹出x87寄存器，第二式继续用未舍入乘积。共享`apps/shared/combat/reload.ts`仅实现已确定的边界与最终换算，输入是累加后的角色字段，不能把TankDelay直接作为输入。`npm run test:combat:reload`执行原EXE的两个边界块和最终计算块，在明确53位x87精度下63组参数逐值一致，含上下限内外与不同factor；D3D初始化后的实际控制字仍待确认。模块尚未接入World原型装填。

网络0x428e85–0x428eb4把message+0x14直接写入角色+0x54，再将relativeClock+duration以f32写入+0x9c，并通知实例时长回调。这说明可用时间还受服务端消息覆盖，完整恢复需接回相应通知和开火限制，不能只实现客户端重算公式。证据追加至combat-client-evidence.json、combat-reload-native.json。

## 战车列解析与完整开火许可函数

原记录解析0x43b76d以`column=20, mode=1`调用0x4391c4，0x43b785将返回float位模式存于记录+0x8c。列解析器0x439211–0x439238明确mode1／字符串类型5通过0x57bbd9解析数值、以f32写入0x635514。原tank.dat列20为TankDelay，导出器直接重读原表验证列名；完整角色重算中的装备／技能累加以及另一记录来源仍须核对，单列基础值不等于最终时长。

完整函数0x435499–0x4354c4先调用0x431d92读取角色flag11。该函数从角色+0x2a0记录的byte+0x127取非零状态；记录不存在则返回false。标记允许后，按`f32(currentSeconds) >= nextAvailable(+0x9c)`判断。相等允许开火。共享`isRoleFireReady`恢复该纯判定；原EXE完整函数（含实际flag getter）执行24组允许／拒绝、截止前／等于／截止后案例，与TypeScript逐值一致，与63个时长计算案例共同纳入test:combat:reload。

本地时间到期提示0x42b60a–0x42b618使用status位0x41检测，仅严格大于截止时刻才通知；它与开火许可的含等号比较不同，不把提示回调替代射击判定。真实角色flag11的更新来源／技能禁用与装备累加尚未全部恢复，World仍保留已声明的原型规则，不能将该标记直接猜成alive。下一步追踪标记更新和完整重算来源，接回通知／输入限制后才能替换。

## 技能列、倍率与装填累加

原技能记录加载0x43acf2–0x43af5c顺序读取column19–61。column34 `Delay`存record+0x124，column36 `LoadTime`存record+0x12c；函数参数数组的`FuncZ1`存record+0x188。原字段加载段对全部342技能执行，parsed原表值在0x4391c4入口供给，43个column顺序及三个字段逐项核对。此结果证明加载字段映射，不包含列解析器／完整对象构造。

原0x432951前缀调用角色虚拟getter9：真实跳转表分支0x43246f读取role+0x24。其值减record+0x188采用signed32减法；仅record+0x2c的TriggerType为14且差值大于0时以差值为倍率，其余均为1。不根据数值位置猜测role+0x24的业务名称。原前缀通过真实getter执行全部342技能×role值1/10/50，共1026案例。

共享`roleSkillMultiplier`与`accumulateRoleReload`分别恢复倍率与累加。两个record整数先signed32 imul，再分别加到原f32角色+0x50/+0x54并fstp保存；没有把加法留到最终统一舍入。1026源技能累加与原块0x4329fd–0x432a2d逐值一致；已有63装填重算和24完整开火许可案例继续通过。原普通炮弹技能2001包含Delay17、LoadTime100，源表中55条技能有非零装填字段。因此TankDelay只是角色基础输入，不能替代完整技能装备累加。

完整接入还缺角色当前16技能槽和装备来源：0x4335ca–0x4335fb逐个查询16槽并调用0x432951；0x4335fd–0x43366a遍历装备字段0x44至0x58，组合键后查技能、查16槽重复和0x432b29条件，再选择性累加；0x43366c后还处理role记录+0x88/+0x8c组合技能。这些原指令已导出，尚未恢复完整inventory/equipment状态与各条件，不将2001的派发默认值推断成角色必然装备。World的完整原始槽位／装备许可与服务端 producer 仍待恢复；当前来源完整的重算规则已接入可用的CPU与真人对局分支。

## 角色技能来源选择与道具展开

原重算0x4334ff的`push4`经基础字段复制保留到0x4335b2虚调用。角色vtable0x5c41b8的+0x20为真实数组getter0x4327ac：index4返回角色+0x2a0记录+0xd0，16项；射击派发使用index0，返回record+0x94，setter只复制7项。两组槽位语义不同。原setter0x432826的index4复制16项到+0xd0、通知31、设置role+0x2b4重算标记，指令已导出；网络初始值和更新时间仍待恢复。

新增共享`combat/role-skills.ts`按原0x4335ab–0x4337d7顺序选择生效技能：

1. array4的16项按槽位顺序查技能并累加，保留重复项；缺失记录跳过。
2. 原equipment getter+0x54为0x4227d8，返回role+0xa0。其+0x44..+0x58的六个基础ID和各+0x18的rank组成signed32(base+rank−1)。不在array4中的技能，才检查被动条件并追加。role记录+0x88/+0x8c的额外组合随后按同一条件处理。
3. 再按profile+0x58/+0x5c/+0x60的3项、role record+0xbc..+0xcc的5项、record+0x70、+0x6c，共10个道具来源查表。每个道具按原0x432fe8展开三技能，仍通过真实array getter4查重复和被动条件，不做全局去重。

被动条件完整原0x432b29为：记录存在、TriggerType0、三个函数中至少一个FuncType1且FuncT65535。原道具加载0x439cd9–0x439d04把column27/28/29的ItemSkill1/2/3写入record+0x108/+0x10c/+0x110。全部204道具执行原三字段加载段，getter入口供给解析后的原表值，列顺序与结果逐项核对。

`npm run test:combat:skills`执行343个完整原被动判断及1096条原来源选择／道具展开序列，Web选择结果与原顺序一致。填充角色使用实际array4与equipment getter；查表存储和属性累加回调供给，缺失array分支提供空getter。覆盖342源技能、204道具、六装备槽、rank组合、当前槽重复、道具重复、缺失查表和装备缺失。它证明来源选择，不代表完整inventory所有权／初始装备或全角色属性重算。

普通炮弹2001的FuncT1为0，不满足这条被动条件；即便道具2001关联该技能，也不能把射击默认值自动加入重算。完整接入继续追踪array4填充／dirty标记处理、role+0xa0装备对象和profile/record道具来源，以及开火许可更新。完整角色来源与服务端生产权限仍未恢复。证据combat-role-skills-native.json与combat-client-evidence.json。

## 角色状态更新、属性重算通知与实际开火许可

共享`combat/role-state.ts`恢复完整原标记getter/setter和数组setter。普通标记的非零参数使record byte+0x11c+index递增并按byte溢出，零参数清除整个byte；不是减计数。index12直接赋role+0x308的低byte且不通知，getter也返回原byte。index8在更新后非零则将role+0x304设为0.5秒；普通标记更新通知33。数组0/1/2/4分别复制7/3/5/16整数，通知28/29/30/31之后才设置dirty+0x2b4。

角色virtual+0x1c的getter3在record存在时读取dirty。原0x42b645累计更新参数至0x6351f8，超过15后读取getter3；值为1时，用真实table/profile/SkillTable/ItemTable/取itemrecord回调调用virtual+0x74→0x433466，随后清累计值。原重算结束依次通知13和5，再清dirty。这里只确认累计单位与阈值指令，没有据其数值推断业务单位。完整重算还要求role+0x2a8战车记录及role+0x2a4宠物记录；重算基础来源和真实库存尚未全部接通。

原0x4259ae按record+0x90的0/1/2/3分派四条状态函数。状态2清全部16标记并依次启用9/10/11，同时清special12、active action和开火deadline；状态0/1/3清9/10/11及active action。状态0/1/2先通知27，状态3没有通知27。`test:combat:state`执行323组完整原标记更新、28组完整原数组更新、8条完整原生命周期（包括真实CRT memset和action selection setter）、dirty getter与重算完成块；只供给记录观察回调和诊断logging，所有字段及通知时刻与Web逐值相同。

World已在对局开始/复活/再战调用状态2，在普通弹丸死亡时调用状态3。普通CPU和真人开火同时经过flag11及`f32(roundRelativeSeconds) >= f32(nextAvailableSeconds)`，deadline按原顺序写`f32(relativeClock + f32(duration))`。不以Unix绝对秒存f32，避免长时间戳精度吞掉装填间隔。显式World夹具确认alive但flag11关闭时拒绝、deadline前拒绝/相等允许，两个相隔巨大的Unix起点具有同样发射tick；另以普通弹丸击毁验证死亡/复活许可和再战重置。许可和时间表示已接入，时长值仍为配置800ms，不能据此宣称完整原装填数值已恢复。

接入后五模式CPU正常自主比赛与冻结/再战/退出通过；真实原0002擒王双连接旁观三CPU、90连续快照/19首局事件一致，10开火7命中及完整结果/再战/断线清理通过。证据`combat-role-state-native.json`、`cpu-realtime-2-full.json`和`cpu-realtime-role-state.log`。下一步恢复array4实际填充消息、装备对象以及profile/role道具来源，使用同一重算标记入口接回完整属性与库存消耗。

## 原数组属性编码与当前技能网络入口

原544c70编码category4数组段，包含byte操作、BE uint16声明总槽数、BE uint16元素宽度、BE uint16条目数；各元素独立反转为大端。mode低byte为1时操作1全量；其余模式按真实5448e0使用的当前/快照存储逐槽比较，变化槽保持升序。当changedCount×(width+2)大于count×width时发送操作3全量，否则操作2仅发送各BE uint16槽位及值；相等仍走增量。发送本身不刷新快照。

六组真实绑定为：属性28快捷槽7×4byte、29战车标记3×4、30战车部件5×4、31当前技能16×4、32纹理3×4、33动作标记16×1。58组原编码覆盖各组全量、不变/首槽/尾槽/半数组/全数组变化及全部342个原skill.dat技能ID的22批16槽编码，生成字节与encodeRoleArrayProperty一致。

真实52a280→53dbd0→544950→53d7e0/53fae0→52a8f0接收链按操作写入：1/3按声明总槽数从首槽写入；2按条目数读取槽索引逐项写入，均使用消息中的元素宽度。声明总槽数/宽度与属性schema不同只产生诊断，原reader继续执行。此次覆盖总槽15但schema16、宽度2但schema4且写入仍在绑定缓冲内的明确用例，不根据这些诊断推断返回拒绝。未知操作返回false；成功段逐段通知，重复/零变化段仍通知，后续失败不回滚前段。dirty位图、发送快照及角色setter/recompute在该接收入口不更新。

130组完整原管理器接收包括全部58编码、上述维度差异、非法操作、重复段、成功后失败和不同数组顺序，分别在无/有观察者时执行。供给元数据type、Winsock和末端观察者/诊断服务；编码、段解析、绑定写入、管理器和通知转发是真实原指令。共享receiveRoleArrayProperties绑定生产RoleCombatState的数组/flags存储，逐项对照结果和通知时刻；随后通过生产selectRoleSkills验证全部342原技能ID及顺序确实进入选择链。这是模块组合验收，未从服务端装备/施放产生实际通知。

验证：npm run test:combat:health与npx tsc --noEmit通过，role-properties-native.json的arrayWireRows/arrayReceiveRows/arraySkillCatalog、role-array-property-suite.log与role-array-property-types.log。原notify31观察者的本机重算/取消表现、真实装备/库存来源及权威施放仍待接入；M4-03保持未勾选。

## 原当前技能增删与OdlPlayer数组绑定

原角色virtual+0x5c/+0x60/+0x64分别为add0x431e22、remove0x431ee5、removeAt0x431f38。三者均先调用真实boolean setter3将dirty设1；record缺失不更新。新增技能先扫描16槽并删除同ID，再写第一个零槽；写空槽本身没有notify31。满槽则返回被挤出的首ID、左移15项并追加、notify31。删除按ID扫描后额外notify31，即使没有找到也通知；按位置删除移动后续槽、清末槽、notify31。原扫描在移位后仍递增index，因此相邻重复可能保留，Web保留该执行结果。负位置先设dirty但不写槽，原日志后端供给；位置15及更大直接清槽15，此处只覆盖真实16槽边界。

`test:combat:state`新增868组完整原增删执行，调用真实dirty setter及嵌套deleteAt，供给记录观察/诊断logging。覆盖全部342源技能、满槽/零槽/孔洞、连续/间隔重复、逐次新增超过容量、逐次删除、record缺失；所有最终槽、返回挤出ID、dirty和每次通知时刻与Web一致。共享变更状态随后交给生产selectRoleSkills→roleSkillMultiplier/accumulateRoleReload→computeRoleReload→finishRecompute，以真实技能字段检查顺序、容量、重算标记及完成清理；这是状态链夹具，不是实际库存或施放消息验收。

原`OdlPlayer`注册0x52278d通过名字、constructor0x522748与class-ID setter0x522781注册动态记录；没有从静态class ID值猜协议编号。原字段绑定0x52262a–0x522739实际执行并记录六组registry调用，供给字段注册/存储后端，原field名/长度/type/地址由原指令提供：

| 原字段名 | 记录偏移 | 项数 |
| --- | --- | --- |
| m_arrayItemHotkey | +0x94 | 7 |
| m_arrayTankMark | +0xb0 | 3 |
| m_arrayTankPart | +0xbc | 5 |
| m_arraySkillTableId | +0xd0 | 16 |
| m_arrayTexture | +0x110 | 3 |
| m_arrayActState | +0x11c | 16 |

因此射击选择getter0是7个道具快捷槽，当前重算getter4是16技能ID槽；+0xbc的五项是战车部件槽。早期网络bitstream记录0x41fa67属于另一结构，不能仅凭相同区域认成这里的OdlPlayer。源OdlPlayer schema wrapper由+4获得真实backend（0x522ba2）。notify31监听分支0x42f76e的完整入口0x42f385与共享role-skill-observer.ts已执行对照，见下节。实际技能施放/移除/消耗消息、装备backend来源及完整属性重算仍待接入玩家库存和CPU技能决策。

## 当前技能槽原观察者与重算调用

原42f385先读取全局当前阶段，状态1直接返回；其余状态由传入记录+0xc的对象ID查询角色，缺失角色直接返回。再用实际字段virtual0读取属性index。property31分支42f76e遍历role+0x320的旧16技能：0跳过，仍存在于当前record+0xd0任意槽的旧ID跳过，消失ID查原SkillTable，只有TriggerType2/3调用486d6f(effectManager, roleID, skillID)。重复旧槽每次独立处理，不去重；缺失技能记录不请求停止。

停止请求期间旧槽快照和dirty保持原值，随后按原指令复制全部当前16项到旧槽。仅当前角色等于owner+0x3c的本机角色时，真实boolean setter432738(selector3,value1)先设置dirty，再以427ba2/427bf9/413c65/413c74取得的四个来源参数，加第五个取道具记录回调422dfd，调用角色virtual+74重算。原433466返回ret20；夹具核对全部五参数并按20字节清栈。阶段0的前两个来源getter返回0，阶段3/4读取owner+20/+24；阶段2经真实资料getter及拥有表结果分派取得两份来源，map节点查找边界供给，见后面的来源选择合同。

1380组完整42f385原执行包括342源技能逐条保留/删除×本机/远端、重复旧槽、零槽、缺失查表、阶段1门禁、普通阶段0/2/3/4及角色查找缺失。阶段getter、角色/技能查表边界、效果停止末端486d6f与完整重算入口供给；字段getter53ff90、角色ID getter431d4d、dirty setter432738及上述来源getter/全局资源指针路径实际执行。逐项对照停止参数、旧槽复制、dirty及停止/重算时刻，证明调用合同，尚不证明效果树完整退役或全属性计算。

共享observeRoleSkillSlots与原执行1379用例一致。另有136组网络数组→同一生产RoleCombatState绑定→观察者→selectRoleSkills/finishRecompute组合，覆盖全量/增量、342源ID、观察者存在/缺失、本机/远端、重复更新和成功后失败；同一全量再次接收时不停止仍存在的技能。本机每个成功段均调用重算，不将重复值通知合并；远端只更新旧槽并停止消失技能，不重算。组合中重算业务为生产技能选择/完成模块，完整基础/装备/攻防属性仍待实现；World未接入此观察者消息链。

验证：npm run test:combat:health与npx tsc --noEmit通过；role-skill-observer-native.json、role-skill-observer-suite.log与role-skill-observer-types.log。M4-03继续进行中，未勾选。

## 技能最大生命累加与重算限制/VIP尾部

原重算4334e8从第一个参数对象+2c复制signed32到OdlPlayer+58最大生命；该基础字段业务来源尚未完整恢复，不把它直接命名为某张战车表列。原skill.dat的实际43acf2–43af5c字段加载段把MaxHP写到技能record+e8；342条源记录的该映射均已执行核对。

完整原432951使用角色实际getter9得到role+24，再按既有TriggerType14/FuncZ1倍率规则计算。432a90–432a99把MaxHP与倍率signed32 imul后加到record+58，保留32位乘法/加法结果。3078组完整432951执行覆盖全部342源技能×role getter9值1/10/50×显式基础最大生命100/200/400；剩余参数为有效可写状态/掌握度存储，实际执行全部累加方法。共享accumulateRoleMaxHp逐值一致，当前HP保持37；该技能累加方法不将skill.HP当即时治疗。

重算先在4337d7限制MaxHP上界，再在43393b限制下界；此次原可执行文件初始全局61e4a0=400、61e52c=100。两限制均用signed32比较。共享finishRoleMaxHp显式接受上下限，未将初始全局值设为所有模式的固定默认。这些全局限制由原datascale加载函数43928a覆盖，源ID1写入0–999；完整加载合同见下节。

原433ce1检查record+50的m_bVIP非零时，将已限制的MaxHP与role+98的signed32值相乘；后面不再应用同一上界。因此VIP倍率可产生超过400或为0的结果。role+98倍率的来源尚未恢复，不默认设为2。随后依次notify13和5，观察者均看到最终最大生命及dirty=true，再清角色dirty。当前HP不在此尾部调整。

96组实际限制/VIP/通知尾部执行覆盖最大生命-20/0/99/100/200/400/401/500、VIP byte0/1/2、role+98值0/1/2/3，当前HP777保持不变。共享限制/倍率与生产RoleCombatState.finishRecompute通知顺序一致。另以22批全342技能的真实数组编码/绑定接收，进入observeRoleSkillSlots→selectRoleSkills→最大生命从显式基础重算→finishRecompute；重复接收仍重算，但不把上次结果当新基础累加。组合不证明完整原433466所有攻防/移动/装备计算或业务来源，尚未接入World。

验证：npm run test:combat:health与npx tsc --noEmit通过；role-max-hp-native.json、role-max-hp-suite.log与role-max-hp-types.log。M2-01、M4-03继续未勾选。

## 原datascale加载与战斗限制来源

原43928a保存行对象参数，按getter4391c4依次读取column0整数ID、column1模式5名称、column2整数Min和column3整数Max，写入记录+c/+2c/+30。名称复制401609及解析后的字段getter作为供给边界；完整原数字加载、ID判断与全局写入实际执行。53个现存datascale.dat源行均已执行，列顺序和每条前后全部23组全局限制逐项核对。

该入口只为ID1/3/4/5/6/7/8/9/10/11/12/13/14/15/16/17/19/20/22/27/28/29/30写战斗全局。ID3/4/5/6/8/10/12/13/16/19/22经signed32 fild/fstp保存f32，其余写signed32；未匹配ID保留这些全局原值。不根据表中其余名称自行补充本入口未执行的限制逻辑。完整53源行仍发布到combat-catalog.json的dataScales，为后续真实业务入口保留原数据。

生命最大值ID1的Min0/Max999分别写61e52c/61e4a0。发射间隔ID16的Min5/Max99经f32写61e53c/61e4fc。因此重算应读取已加载限制，而不能把可执行文件初始化时100–400或6–30视为最终配置。共享role-data-scale.ts按原ID及整数/f32存储类别应用行，未知ID不改战斗限制。computeRoleReload显式接受限制对象；保留上下界比较和原x87/f32换算顺序，不设固定默认。

全部53源行加载后，实际执行原生命上下界块6组（-1/0/100/400/999/1000），当前HP777保持不变，最大生命被限制到0–999。18组真实装填上下界与最终转换覆盖基础值4/5/6/30/99/100及三个倍率，共享读取发布目录并计算的结果逐值一致。既有63个初始化限制转换样本仍显式传入该原执行夹具记录的限制；状态组合则读取目录ID16使用5–99。既有342字段加载、1026技能装填累加、角色状态与World许可/死亡/复活/再战回归通过。

验证：npm run test:combat:health、npm run test:combat:reload、npm run test:combat:state与npx tsc --noEmit通过；role-data-scale-native.json、role-data-scale-suite.log、role-data-scale-reload.log、role-data-scale-state.log、role-data-scale-types.log。取证仍供给解析后的原源行，不证明原表管理器完整初始化/资源选择；基础生命对象、真实装备来源及完整生产重算尚未恢复。原型HP与完整服务端生产权限仍未恢复，M2-01/M2-02未勾选。

## 两份重算基础对象的阶段与拥有实例选择

原427ba2和427bf9分别产生433466前两个参数。二者均先读取全局当前阶段：0/1及大于4返回0；阶段3/4直接返回owner+20/+24；阶段2进入真实4269c4，返回owner+40指向的容器+20内嵌SPrPlayer对象。

SPrPlayer实际vtable5c4118的virtual+18为42fdc5，其常规路径再进入DB getter42029e。第一来源的selector28读取DB+84，第二来源selector29读取DB+88；DB位于SPrPlayer+20，因此这两个值是各自拥有实例查找的uint32键，不是基础属性对象指针。第一来源使用容器+10的41e99c拥有表，第二来源使用容器自身的421f36拥有表。两者均调用4501fa节点查找，等于end sentinel则返回0，否则返回节点+10存储的记录对象。阶段2即使实例ID0仍调用查找，不自行添加跳过0的规则。

96组完整来源getter原执行覆盖阶段0/1/2/3/4/5、两个selector、实例ID0/73/80000001/ffffffff、直接对象存在/缺失及拥有查找命中/缺失。阶段getter和4501fa map节点查找供给；4269c4、真实资料virtual getter42fdc5/42029e、41e99c/421f36的结果/end gate与427ba2/427bf9完整执行。共享resolveRoleRecomputeSource逐项匹配结果和查找键/调用条件。它接受一张显式拥有表的lookup回调，调用者为两个来源各提供其实际表，不将实例ID混成原表ID。

完整property31观察者原夹具另覆盖阶段2本机角色的两份来源查找，五个重算参数实际来自上述入口；全部1380组原观察者对照通过。内嵌资料/拥有表及记录由夹具准备，完整初始化、真实拥有记录消息写入和基础MaxHP字段的业务值仍未恢复；不能据此给空账户分配基础对象或数值。共享来源选择尚未接入World。

验证：npm run test:combat:health及npx tsc --noEmit通过；role-recompute-sources-native.json、role-recompute-sources-suite.log、role-recompute-sources-types.log。M2-01/M4-03继续未勾选。

## 拥有基础记录整数接收与MaxHP字段

第一来源拥有表的批量读取41f23c为每条记录分配98hex字节、调用构造41e90e，再调用41e5f1读取；本轮执行该单记录整数reader。真实顺序：+4和+0各32位；+8/+84/+34/+38/+8c/+80/+88/+7c/+3c/+40/+2c/+30/+94/+28/+90各16位，均先清DWORD再读取；然后读+0c名称；随后六组+44+4i与+5c+4i各32位，最后+74/+78各32位。16位值按零扩展保存，不据原表字段名字将其转换为signed16。

原4334e8直接把第一来源对象+2c的四字节复制到OdlPlayer+58。此字段在41e5f1线路上为16位无符号值，当前HP+54不在这条基础复制中变化。共享readOwnedRoleBaseRecord按实际字段偏移与位宽读取，名称位置使用显式reader.name回调，ownedRoleBaseMaxHp提供真实+2c来源，不按猜测分配基础生命。

32组原执行覆盖8种位对齐和seed0/37/80000001/ffffffff产生的16/32位字段序列，真实401d58位读取及完整41e5f1执行；名称401fa6仅供给不消费位的空名边界。因此夹具数值前缀/尾部连续排列只用于该名称边界，不能作为完整线路包格式。全部字段/总读取位数与共享reader一致，后续真实4334e8复制逐项一致。共享组合再经原阶段2实例查找合同选择此记录，使用已恢复datascale限制计算MaxHP；当前HP777不变。

验证：npm run test:combat:health与npx tsc --noEmit通过，role-owned-base-native.json、role-owned-base-suite.log、role-owned-base-types.log。原名称编码、批量拥有表构造/插入和外层消息类型/接收、服务端如何生成基础记录及真实账户归属仍待恢复，World尚未接入。M2-01保持未勾选。

## 拥有基础记录完整名称位流

真实名称reader401fa6先以401d58读取32位无符号字节数，清空目的字符串，再以401bd7逐byte读取并追加；读取使用当前位流游标，不先对齐。现有96组完整41e5f1执行覆盖8种起始位对齐×空/英文/非ASCII名称字节×四组16/32位整数值。401fa6、32位计数读取与逐byte读取均执行原指令，仅字符串清空401609/追加401f16的存储边界供给；所有字段、名称字节、最终位数与实际MaxHP复制一致。

共享readOwnedRoleBasePacket已读取完整数字前缀→真实名称字节段→数字尾部，返回endBit和原nameBytes，使用显式decodeName回调处理字符文本。测试按原字节比对，不从非ASCIIfixture推断已证明客户端字符编码。先前空名称零位回调的夹具已由此完整名称reader替换；前节32组证据说明的是早期整数范围，当前原执行范围以96组为准。外层拥有记录消息、批量记录表写入及服务器来源仍未验收。

验证：npm run test:combat:health与npx tsc --noEmit通过；role-owned-base-native.json、role-owned-base-name-suite.log、role-owned-base-name-types.log。M2-01保持未勾选，World原型尚未替换。

## 基础拥有表批量替换与重复实例

原41f23c先对table+4调用41e852清旧树节点，再从位流读32位无符号记录数。每条分配98hex字节，调用真实41e90e构造、41e5f1完整数字/名称读取，按record+0实例ID进入真实41f0dd/41edb2红黑树插入。索引按无符号键比较，重复键不替换首个记录；外层批量函数仍已分配并读取重复记录，不跳过其载荷。原清理41e852只释放树节点；记录对象释放不由本清理入口证明，不将JS索引替换解释为原对象析构。

连续5批原执行覆盖3条输入、同批重复键不同MaxHP数值、空批清旧表、5条输入及单条再次替换，起始位对齐0/1/3/7。真实记录构造、读数/读名、清树、插入/平衡和重复门禁执行；分配/释放及字符串存储供给。每批检查原排序后的完整字段、读取游标、分配数量和旧表替换状态；重复键保留首条MaxHP200而非随后202。原执行fixture初始化空sentinel树，不证明完整table类构造和全局初始化。

共享receiveOwnedRoleBaseBatch清旧索引后读记录数、逐条完整解析，以无符号实例ID保留首个记录，返回最终位游标。五批与原表状态逐项相同，再经resolveRoleRecomputeSource查找到同一基础MaxHP。此入口尚未连入原外层消息、持久账户及World；第二来源拥有表格式仍待恢复。

验证：npm run test:combat:health与npx tsc --noEmit通过；role-owned-base-native.json的batches、role-owned-base-batch-suite.log、role-owned-base-batch-types.log。M2-01保持未勾选。


## 基础拥有记录消息0x4078

原类型getter52083e返回0x4078；完整reader520819先以message+0c调用41f23c替换基础拥有表，随后清message+1c并用401d58读取32位无符号值。此字段的业务含义尚未恢复，共享receiveOwnedRoleBaseMessage保留字段偏移名称field1c，不将它解释为状态或归属。消息类构造520795和析构5208ab已定位，构造及消息分派未纳入执行验证。

五个完整消息在同一原树上连续读取，覆盖起始位0/1/3/7、空批、重复实例、旧树替换，尾值0/ffffffff/80000001/73/1。执行真实520819、41f23c、构造/插入/平衡和位读取，供给的边界仍为分配/释放及名称字符串存储。类型getter、完整表字段、尾值、栈返回和位游标均核验；共享模块逐批匹配原树替换及尾字段读取结果。0x3aab的另一调用42d6a5还读取第二拥有表4225b4和额外数组42d6cd，未纳入本消息合同。

验证：npm run test:combat:health与npx tsc --noEmit通过；role-owned-base-native.json的messages、role-owned-base-message-suite.log、role-owned-base-message-types.log。原消息接收处理、服务器记录生成与账户归属、第二来源拥有表及World接入仍待完成；M2-01保持未勾选。


## 第二来源拥有记录、批量替换和真实实例查找

原421afe对70hex字节记录先读取+0名称；随后+68/+58/+5c/+60/+64/+20各32位，+3c/+40/+44/+4c/+50/+54各16位，+34/+1c/+24/+28/+2c/+30各32位，最后+6c读6位、+38和+48各读1位。每个数值目标先清DWORD，短字段按零扩展保存；不将不明字段按名字转换为有符号数或浮点数。共享role-owned-equipment.ts按此顺序保留偏移字段与名称解码回调。

完整4225b4先调用421e06清旧树节点，再读32位记录数，逐条分配70hex字节并执行真实421ec2构造、421afe读取；取record+1c作为无符号索引，经真实4221d8及422078树插入/平衡，重复键保留首条。清树入口不证明拥有记录析构。96组完整单记录覆盖8种起始位、空/ASCII/原非ASCII名称字节和四组数值；5个连续批次覆盖空表清旧索引、重复实例不同字段、递减插入、unsigned高位键。每批执行真实421f36→4501fa→486351查找，命中和缺失均与共享Map及resolveRoleRecomputeSource组合相同。原分配/释放和字符串存储边界供给，空表sentinel初始化，不将此测试解释为完整全局表构造。

## 完整双来源消息0x3aab

原类型getter42d69f返回3aab；完整42d6a5依次读取message+0c基础表41f23c、message+1c第二表4225b4、message+2c附加字节数组42d6cd。附加数组的声明数量为32位，保存在message+102c；数量为0时不读字节，非零且小于stream+0c容量时读取count×8位，否则诊断后保留旧数组字节且不推进载荷游标。共享receiveOwnedRoleSourcesMessage显式接收原stream容量；拒绝分支返回additional为undefined以表达未写入，保留声明数量，不把拒绝当作空数组。

5个完整原执行消息连续替换两张真实树，包括非字节对齐、重复实例、空表与0/128/255附加字节。共享模块逐项比较两表所有字段、附加数组和最终位游标；3个容量等于/超过分支另执行真实原reader，验证两表先清空、附加旧字节保持不变。字段业务含义、附加数组语义、原消息接收处理、服务器如何产生记录与账户归属、完整装备/角色属性合成及World接入仍待恢复。

验证：npm run test:combat:health、npx tsc --noEmit通过；role-owned-equipment-native.json的rows/batches/messages/arrayGates、role-owned-equipment-suite.log、role-owned-equipment-types.log。M2-01与M2-02保持未勾选。


## 完整重算的基础初始化与源技能累加组合

原4334e8–4335b2在技能/道具遍历之前完成初始化。角色记录+58复制第一来源+2c；role+68/+6c由第一来源+34/+3c执行signed32 fild→f32，role+78/+88复制第二来源+40/+50。role+84/+80由战车表+ a8/+a4执行signed32 fild→f32；role+50直接复制战车表+8c的f32位值，role+54清零。角色记录+38复制战车表+90；role+8c/+94/+74/+7c/+90清float零，role+70/+58清整数零。当前HP（角色记录+54）不写入。

六个后续累加器依次取战车表+84/+88、宠物表+7c/+80/+84/+88，分别对应stack local-10、argument8、local-8、local-c、local-4、argument18。完整初始化以第一个数组getter调用4335b2为边界；共享initializeRoleRecomputeBase返回记录写入、角色整数/浮点写入和六个有序累加器，不将偏移尚未确认的字段命名为具体攻防属性。

96组原执行使用两类原reader输出字段和显式战车/宠物表记录，逐一核验全部初始化字段、六个累加器及保留HP777。覆盖原16/32位拥有字段、负/零/正f32基础装填、signed32整数转float与16777217舍入。组合验证全部342源技能：重新执行原基础初始化，供给解析后的原技能列，执行真实43acf2–43af5c字段loader及完整432951累加；role9取1/10/50，MaxHP与两个装填字段和共享初始化→accumulateRoleMaxHp/accumulateRoleReload逐值一致。生产共享解析直接读取原bitstream证据，不只用手写基础数值。

验证：npm run test:combat:health与npx tsc --noEmit通过；role-recompute-base-native.json的rows/combinations、role-recompute-base-suite.log、role-recompute-base-types.log。战车/宠物完整表初始化与来源绑定、完整16槽/装备/道具遍历、其他字段合成、最终限制与许可消息的完整业务链、World权威重算仍待恢复；该组合不等于完整433466或M2-01/M2-02完成。


## 完整技能属性累加与道具展开后的实际计算

共享accumulateRoleRecomputeSkill恢复完整432951的写入顺序。角色float字段：+74←Atk，+84←BackDef，+68←Critical，+7c←Def，+50←Delay，+54←LoadTime，+94←HPDrain，+8c←HPRegainRate，+6c←Lucky，+80←SideDef，+90←StunRate；每步按已有f32字段加新值并存f32。Atk和BackDef以signed32源值和倍率执行x87乘法，其余此处float增量先signed32 imul再加，不能统一成相同乘法。角色integer+70/+78/+88/+58分别累加AtkBase/AtkBonus/DefBonus/MaxCounter，记录+38/+58分别累加MaxBullet/MaxHP；所有integer运算按signed32回绕。六个局部累加器依次累加ItemMove、ItemTurn及四类TankMastery。HP/PartSlot/Radar字段不被本函数写入，不按列存在猜测生效。

342条技能在实际初始化结果上执行完整432951，逐项记录并比较两个记录字段、四个角色整数、十一个角色float和六个累加器。原技能列loader43acf2–43af5c执行，parsed源列供给；夹具中loader和重算的栈存储分开恢复，保持重算局部值。现有MaxHP/装填组合对照仍通过。

原432fe8接收ItemTable记录，为其+108/+10c/+110三个技能ID逐个查SkillTable，查不到跳过；用真实getter4读取当前16槽，已存在的skillId跳过；调用真实432b29被动条件，成功后调用真实432951。null ItemTable记录不展开。共享selectRoleItemSkills为该选择路径，selectRoleSkills复用它，保留同一道具三个位置和多个道具的重复来源，不在被动追加后修改当前槽列表。

204件原道具及null两种槽状态共410组完整432fe8执行：空槽与三个ItemSkill都已写入当前槽；供给SkillTable查找和源ItemSkill字段，执行真实数组getter、被动判定和完整属性累加。共享源catalog选择的skill序列与原一致，全部属性和六个累加器匹配，当前HP777不变。既有原道具列加载及全来源选择由test:combat:skills回归验证。完整433466的来源遍历与最终全属性边界/转换、真实账户装配和World权威接入仍待完成。

验证：npm run test:combat:health、npm run test:combat:skills、npx tsc --noEmit通过；role-recompute-base-native.json的combinations.values/itemRows、role-recompute-skill-suite.log、role-recompute-item-selection.log、role-recompute-skill-types.log。M2-01/M2-02保持未勾选。


## 完整属性限制与最终转换

limitRoleRecomputeValues恢复4337d7–433ad6：记录+58/角色+8c/+94/+68/+6c/+70/+74/+78/+7c/+88/+80/+84/+50/记录+38/角色+58/+90分别用datascale ID1/3/4/5/6/7/8/9/10/11/12/13/16/17/20/22限制；移动和转向累加器用ID14/15。先执行全部上限，再全部下限；不限制role+54装填倍率或四个精通累加器。共享显式使用已经加载的限制，不固定EXE初始值。

convertRoleRecomputeValues恢复433c55–433cf4：HPDrain/StunRate/Lucky/Critical/HPRegainRate/Atk/Def/BackDef/SideDef对应float字段乘原f32百分比常量0.01，逐字段存f32；装填基础乘f32 0.1存f32，但特殊装填继续用未舍入乘积乘倍率和f32 0.03，再存f32。最后VIP非零时MaxHP乘role+98按signed32回绕，不再次限制，当前HP不变。此函数在精通装备攻防加成之后调用。

758组原执行包括342技能合成结果、410道具展开结果及6组全字段上下限输入，执行完整限制块和完整转换/VIP块；原43928a加载证据中的实际global限制写入fixture。共享加载源datascale并核对所有global值后，全部限制结果/六累加器/转换字段逐值一致。fixture限制结束时移动累加器0暂存在EAX，直接读该寄存器，不将旧stack局部当最终值。

## 精通分支、移动转向参数与装备攻防加成

applyRoleRecomputeMastery恢复433ad6–433c55。第二来源+34等于0时四类精通各signed32减1并最低为1；否则保持。战车表+50为1/2/3/4时依次使用STank/MTank/LTank/Stug精通；其他类型不调用移动/转向setter或添加装备攻防。原setter selector10参数为f32((mastery+moveAccumulator-3)×global61e494+50)，selector11为f32((mastery+turnAccumulator-3)×global61e498+原f32常量0.19198620319366455)。global初始值分别10及0.06981316953897476；共享显式接收尺度，不把它们当已恢复的资源加载默认值。

真实421c4b/421c7a计算signed32((mastery×5+10)×4)，乘f32 0.01，再乘第二来源+3c/+4c的uint32，分别加入Atk/Def浮点字段并存f32；之后才进行最终百分比转换。这两个原函数以fild及负值补2^32读取uint32，不能把源字段解释为signed32属性值。

758组完整433ad6–433c55原执行覆盖第二来源+34为0/1、tankType0至5、全部已有合成/限制输入。读取真实分支后寄存器和stack中的六个累加器，执行真实421c4b/421c7a；仅float setter在vtable边界捕获参数，未执行最终setter副作用。共享四类精通、setter有序参数、Atk/Def逐值匹配。此验证分开执行限制、精通及转换段；整段433466调用/来源遍历/通知顺序与生产World尚待接入。

验证：npm run test:combat:health、npx tsc --noEmit通过；role-recompute-limits-native.json、role-recompute-mastery-native.json、role-recompute-tail-suite.log、role-recompute-tail-types.log。M2-01/M2-02继续未勾选。


## 完整433466重算组合对照

共享recomputeRoleAttributes按原顺序组合基础初始化、selectRoleSkills的16槽/六组装备/额外技能/十个道具来源、完整属性累加、上/下限、精通/移动及装备攻防加成、最终百分比/装填/VIP转换，随后notify13、notify5、clearDirty。观察者明确提供移动setter与通知边界，不将计算结果写入原型World。技能数组缺失时，原433466在基础初始化后退出，不执行限制/转换/通知，不清dirty；共享返回completed=false并保留基础结果。

548组完整原函数调用从433466入口执行到真实ret20，包含342技能、204道具及缺失槽等用例，当前槽重复两次、六个装备来源重复、额外来源、十个道具来源重复；装备记录存在/缺失交替，四类战车和类型0/5、VIP非零/零、role9值1/10/50。真实getter9、getter4和装备getter、全部技能/道具分支、432951/432fe8/被动判定、完整限制/精通/转换、通知调用及dirty尾部执行。SkillTable/ItemTable查找、float setter和通知在边界供给/捕获；拥有基础/战车/宠物来源预先解析准备。真实原函数每次校验栈返回、HP777不变、最终dirty。

共享组合逐项比较实际选中skill序列、两个记录字段、四个角色整数和十一个角色float、移动setter有序参数、通知13/5时刻的完整属性及dirty=true、返回后dirty=false。缺失数组时没有后续通知且dirty保持true。fixture ItemTable技能字段来自源表，原列加载另由既有test:combat:skills证明；完整资源管理器初始化、账户归属/装配及最终setter的副作用仍未执行。此结果证明完整计算合同，不等于真实服务器伤害公式或World已接入。

验证：npm run test:combat:health、npx tsc --noEmit通过；role-recompute-native.json、role-recompute-full-suite.log、role-recompute-full-types.log。M2-01/M2-02继续未勾选；下一步补齐正式表来源绑定及账户装配，接入CPU/真人共同的权威角色重算。


## 原战车表完整加载与正式配置绑定

完整43b62a读取tank.dat全部30列，列0整数ID写record+c，列1/2模式5写名称/说明，列3–19与21–29模式0整数，列20模式1 f32 TankDelay。重算实际使用字段映射：TankType→+50、TankMove→+84、TankTurn→+88、TankDelay→+8c、TankBullet→+90、SideDef→+a4、BackDef→+a8。21条源记录执行真实完整loader，parsed列getter及字符串存储供给，核验完整列/模式顺序、表引用和重算字段。

共享readRoleTankBase采用已验证映射并按原integer/f32转换，服务端正式TankConfig新增recomputeBase从已加载原表读取。21条共享值与真实loader输出一致，实际服务端配置逐条匹配。逐车TankDelay已投影到正式配置并由角色重算消费；完整角色来源、装备许可与原服务端 producer 仍待恢复。

548组完整433466 fixture改用全部21条原loader输出，真实战车型别/移动/装填/弹量/侧背防御进入完整原函数及共享重算，最终属性、技能来源、通知与dirty继续一致。宠物、移动尺度资源选择、网络角色实例查表/账户装配及World接入尚未完成。

验证：npm run test:combat:health、npx tsc --noEmit通过；role-tank-base-native.json、role-recompute-native.json、role-tank-base-suite.log、role-tank-base-types.log。M2-01/M2-02保持未勾选。


## 原宠物表加载与正式精通来源

完整43a91c读取pet.dat全部32列，ID写record+c；列1 PetName和列4 PetInfo以mode5复制到+10/+34，其余mode0整数。列16/17/18/19 STankMastery/MTankMastery/LTankMastery/STugMastery写+7c/+80/+84/+88，正是完整433466初始化六累加器中的后四个来源。共享readRolePetBase保留原整数转换和此映射；服务端PET_BASES由实际已加载pet表生成，不推断默认宠物或账户拥有。

10条源宠物执行真实完整loader，parsed getter及字符串存储供给，核验32列/模式/字符串位置、表引用与四类精通字段；共享和正式服务端配置逐条匹配。548组完整原433466调用已改为使用21条战车及10条宠物原loader输出，全部最终属性、来源选择、移动/转向参数、通知13/5和dirty与共享组合一致。角色网络实例选择、账户实际宠物装配、尺度资源加载和World权威调用仍待恢复。

验证：npm run test:combat:health、npx tsc --noEmit通过；role-pet-base-native.json、role-recompute-native.json、role-pet-base-suite.log、role-pet-base-types.log。M2-01/M2-02保持未勾选。


## 网络角色字段到正式战车/宠物表绑定

原426509–42653f先读取角色消息+78，执行真实413c83：global633588→+114→+80宠物管理器，table+0c查找命中才写role+2a4。随后读取message+68，执行真实413c95取得同一服务+84战车管理器，命中才写role+2a8。任一查找缺失保留原引用；不自动选第一条记录，也不清零。共享bindRoleSourceTables显式按同一顺序执行查找和命中赋值，message字段以偏移保留名称。

242组原执行覆盖21战车×10宠物全部组合，以及单侧/双侧missing；真实全局服务getter执行，只有table查找供给，检查有序key与最终角色引用，栈保持不变。共享使用正式TANKS.recomputeBase/PET_BASES逐项匹配。548组完整重算共享对照已通过bindRoleSourceTables从消息字段选取正式服务端表，再进入完整计算；与原433466最终结果继续一致。

验证：npm run test:combat:health、npx tsx recovery/evidence/attributes/role-recompute.cts、npx tsc --noEmit通过；role-table-binding-native.json、role-table-binding-suite.log、role-table-binding-recompute.log、role-table-binding-types.log。外层角色建立消息reader/实际账户装配、移动尺度资源来源、setter副作用及World调用仍待恢复，M2-01/M2-02保持未勾选。


## 移动setter的记录写入与重算中间通知

原角色vtable5c41b8的+2c为432658。selector10将传入float32位值写角色记录+48，然后通知属性9；selector11写记录+4c然后通知10。记录不存在返回false、不写入/通知；成功返回true。setter不检查值是否改变，每次都通知，不修改role dirty。共享setRoleMovementProperty按相同时序写move/turn并通知。

验证原setter全部真实精通尾部产生的移动参数，在记录存在/缺失和dirty0/1下执行完整432658，观察者读取写入后的两个float和dirty。完整433466 fixture进一步执行真实432658，而非替代setter，只在记录通知边界捕获；共享重算在精通计算出参数后、装备Atk/Def加成之前调用移动setter观察者，因此中间notify9/10读取的是此时尚未添加装备攻防的属性。最终notify13/5在全部转换后发生。548组完整序列与中间/最终属性状态逐项一致。

验证：npm run test:combat:health、npx tsc --noEmit通过；role-movement-setter-native.json、role-recompute-native.json、role-movement-setter-suite.log、role-movement-setter-types.log。真实属性管理器广播、尺度/账户装配及World接入仍待推进；M2-01/M2-02保持未勾选。


## 完整重算到实际属性dirty标记

完整433466 fixture的记录通知已使用真实521e8a，记录virtual+10为真实522ba2读取record+4管理器，管理器virtual+28指向真实529a10。记录与角色vtable分开；准备管理器vtable和八个dirty字，不执行完整manager构造。通知处只观察输入和当前属性，继续执行原529a10，不代替位设置。

548组完整重算验证最终八字dirty位图。四类战车在移动setter时通知9/10，最终通知13/5，形成这些属性的pending位；缺失技能数组时初始化后退出，无通知、属性pending位保持零，同时角色重算dirty仍为true。共享组合调用已验证markRolePropertyDirty，与原八字结果、通知参数/顺序/属性时刻一致；角色重算dirty与管理器属性pending不是同一状态。

验证：npm run test:combat:health、npx tsc --noEmit通过；role-recompute-native.json的dirtyWords、role-recompute-dirty-suite.log、role-recompute-dirty-types.log。完整属性扫描/发送、网络广播和World权威调用仍待接入；M2-01/M2-02保持未勾选。


## 持有实际属性的角色重算状态

RoleAttributeState将完整计算接到可持有的记录状态：保存全部RoleRecomputeValues，更新record.maxHp/maxBullet以及move/turn，保留当前hp；每次通知先发布对应阶段属性，再调用现有markRolePropertyDirty和外部观察者。移动通知经setRoleMovementProperty写实际值后通知，完成通知之后才清角色dirty。缺失技能数组时保存已执行的初始化结果、不发通知、不清角色dirty。管理器propertyDirty独立保持pending位，重算不会自行清发送标记。

548组原完整重算结果对照验证该状态模块的最终全部属性、四种通知时刻、pending位、角色dirty、最大生命/弹量/移动写入及HP保留。每组将角色dirty重新置true后再次从相同明确来源重算，结果与通知再次相同，不累加上次计算值。来源通过正式服务端表绑定；状态模块未接入World或账户默认装配，现有AccountInventory只持有物品记录/七快捷槽，不提供完整两类拥有来源。

验证：npx tsx recovery/evidence/attributes/role-recompute.cts、npx tsc --noEmit通过；role-attribute-state-suite.log、role-attribute-state-types.log。M2-01/M2-02继续未勾选，下一步补齐角色拥有来源/账户装配与正式World调用。






## 当前弹药槽与确认表ID

原432528 selector11写OdlPlayer+3c（m_iCurrentBulletId），经真实521e8a→522ba2→529a10通知属性6之后才清role+308（flag12）。相同值也通知，不按快捷槽范围限制，不改重算dirty。selector12独立写record+40（m_iNowBulletTableId）并通知属性7，不清flag12，也不改dirty。缺record返回false且不写/不通知；基础432349与联网422b44的两个getter保持全部DWORD。512组原完整setter/getter执行覆盖两selector、记录有/无、dirty0/1、flag12为0/7、四旧值和八输入值，包含0/1/2/8/2001及高位。通知回调读到已写入字段和清理前flag12，八字pending位仅6或7，记录其他字节不变。

RoleCombatState的setSelectedAmmoSlot/selectedAmmoSlot、setCurrentAmmoTableId/currentAmmoTableId接此合同。World删除独立selectedAmmoSlot存储；重建服务端接受普通数字键选择后调用角色setter（不是原客户端请求入口的写入行为），房间快照和默认/特殊弹药装填门禁均读实际record+3c。生产初值取原构造的1，不再使用独立原型初值0。选择只更新槽位，不把槽数推定为表ID，也不在选择时修改弹量或伪造已确认弹药变更；record+40的独立setter供确认链调用，当前生产仍为初值2001。

验证：npm run test:combat:ammo-selection、npx tsx tests/combat-item-hotkeys.cts、npm run test:combat:item-input、npm run test:network、npm run test:cpu、npx tsx tests/world-role-attributes.cts、npx tsc --noEmit通过。4,936组原快捷槽决策；普通键2真实写入record+3c=2、快照同值、确认表ID保持2001；空库存/旧输入/等待阶段拒绝与账户跨服务重启输入通过。独立服务端真实双连接确认原默认槽1和普通默认弹药发射，五模式CPU各两轮、原World126属性/21战车开火与再战通过。

证据role-ammo-selection-native.json、role-ammo-selection-native.log、role-ammo-selection-suite.log、role-ammo-selection-hotkeys.log、role-ammo-selection-input.log、role-ammo-selection-network.log、role-ammo-selection-cpu.log、role-ammo-selection-world.log、role-ammo-selection-types.log。原428cd2在owner+ec可选UI不存在的路径已完整执行。owner+3c缺角色只走诊断，不调用时钟或观察者；有角色时，先把原消息+c的DWORD转发给owner+6c观察者（该字段业务含义保留未知），再把消息+14的float写入role+54，然后调用原相对时钟并把f32(clock+duration)写role+9c，最后向owner+7c观察者报告duration。不按非负范围夹取时长，零值和负值保留，不更改角色数字记录/弹量/当前槽/确认表ID。400组完整入口覆盖角色有/无、两观察者有/无、五个+c值、五个时长及两个double时钟，逐项对照通知时刻的+54/+9c和完整记录不变。时钟返回、诊断与两终端观察者供给，角色字段写入/加法/完整入口实际执行；有UI路径的恢复范围见本节下文。

applyRoleAmmoChangeReloadNotification恢复该无UI确认合同。RoleCombatState.roleFloatFields持有已知真实role浮点写入，缺字段保持缺失；RoleAttributeState在发布各阶段属性时同步计算的所有roleFloats，World默认弹药开火和诊断现在从实际角色字段读取+50/+54。确认写入+54后，下一次m_iBullet==1的开火读取覆盖值；其他弹量仍读+50。再次原重算按原顺序覆盖+54，不保留已过时确认值。564组原重算在通知时与最终实际roleFloatFields逐项一致，254组缺来源保持既有浮点字段；400组确认与当前弹量分派组合通过，World126属性/21战车开火与五模式CPU各两轮回归通过。尚未接生产确认消息，未通过选槽伪造确认时长。

原客户端请求与确认必须按方向区分：4cb2f5快捷键分派到完整426419，默认槽1在角色存在且实际43293d状态2时发送；当前槽getter11虽然被读取，但相同选择仍发送。42592c构造请求vtable5c32a4，type423d7c同为3ab5；调用方只写packet+c槽号，不写packet+10，也不直接修改当前槽、弹量或确认表ID。521a15/42595f请求codec只包含两个DWORD，共64位；下面的确认包含三个字段，共96位，不能混用。请求field10必须由调用方显式提供，业务意义未恢复，生产路径不补造0。默认槽完整入口160组与原64位codec160组通过；共享role-ammo-request-wire.ts逐字节对照八种对齐，并拒绝短包与无效偏移；96位确认decoder拒绝这些64位请求。

测试夹具修正：原完整函数的prologue调用可在构造前改写原先填入的栈seed，本例packet+10可保留此前call的返回地址；因此验证的是42592c入口处值在构造/发送后保持，不宣称初始seed就是实际发送值。证据role-ammo-request-native.json/log、role-ammo-request-suite.log；npm run test:combat:ammo-request通过。npx tsc --noEmit与npm run test:cpu通过（role-ammo-request-types.log、role-ammo-request-cpu.log），后者为五模式各两局普通输入模拟回归，不是实时网页验收。特殊槽2–8完整426419已执行4,345组门禁：全部204源物品、七个槽、原43d186两个库存vector搜索与43bd13/439762分类，覆盖错误库存组、缺记录、DWORD实例0/高位、越界槽、零数量及重复实例首组优先。该入口本身不检查数量；普通4cb2f5快捷键外层仍拒绝空量。共享requestRoleAmmoSelection逐组对照，发送不修改数字字段/flag/数量，相同选择仍发送；正式dispatchItemHotkey现调用该入口门禁后再进入重建服务端acceptance，不以codec未知字段充当库存实例。npm run test:combat:item-input的正常World输入与隔离双连接账户/服务器重启通过（role-ammo-request-input.log）。生产旧协议请求接收、确认产生条件仍未恢复；槽0在正常快捷键外层被拒绝，其直接调用的相邻内存读取行为未实现。World即时写selection仅是现有重建服务端处理，不等价于原客户端426419。

原注册段42bc94–42bcc6将428cd2绑定到UmsgPrNotifyChangeBullet，监听type getter423d7c为3ab5。真实工厂42eb98申请24字节，经4248d5/402289构造并安装5c3f60虚表；原构造不初始化body+c/+10/+14，seed aa三字段在构造后保持，不能宣称包体默认零。reader42ebf8按序清零并读两个DWORD与一个float；writer425f2c按同序写96位LSB-first原始字段。800组原codec→原解码对象→完整428cd2无UI确认链覆盖五个+c、四个+10、五个时长与八种位对齐，字节/高位DWORD/时长、观察者参数与倒计时一致。+10在有UI分支被用作43d728库存查找键，该包装依次查43d186/43d1a5、缺失后进入43cd5b；该查找的内部三种库存路径仍由已有库存模块承接，UI分支的控制流见下文。

role-ammo-change-wire.ts提供3ab5/96位编解码与receiveRoleAmmoChange，解码后调用已验证的实际角色时长覆盖，保留未知+c/+10，不在包体中补默认值或推定确认产生条件。800组共享字节/解码/真实角色字段与原完整链逐项一致。证据role-ammo-change-native.json的wireRows/messageType/constructorLeavesBodyUninitialized、role-ammo-change-suite.log与role-ammo-change-wire-types.log；npm run test:combat:ammo-change、npx tsc --noEmit通过。共享接收现在另提供receiveRoleAmmoChangeEnvelope，按确认方向读取16位type、16位identity并以bit32调用原96位body解码；短头、短body或其他type在角色写入前拒绝。该入口尚未接实际生产TSRPC/旧socket消息。

原整包接收链：完整42b7e7构造23个静态战斗监听器；420f39初始化空基础监听表，4218f0执行真实角色管理器基类构造。测试按42f9bb/42f9c9准备派生vtable5c3a18/5c3a10，不声称执行完整42f997玩法/视觉构造。真实427aba枚举器与402ec8将监听表注册到三个403096接收器；实际生产构造42f997在42fb32/42fb47/42fb5c分别向globalGame+bc/+d4/+c8注册。原确认监听器423d3e安装vtable5c2ee8、handler428cd2；5c3b48是监听器名称字符串，不是其vtable。

324组16字节原envelope覆盖三个接收器、三种identity、三种+c/三种+10、四个原f32时长；真实4038d5→4027c3→40266a树路由→工厂42eb98→reader42ebf8→48b28c转发→无UI428cd2→析构/24字节池回收全链通过，身份/metadata/context/connection顺序正确、读满128位、角色数字记录不变。仅供给分配/释放、锁、GetTickCount、日志和相对时钟边界。共享envelope接收324组与最终角色字段/时钟调用顺序对照通过；没有用这个测试证明Winsock读包、确认producer、完整玩法管理器初始化或原短包行为。共享短包拒绝是重建入口校验。证据role-ammo-receive-chain-native.json、role-ammo-receive-suite.log、role-ammo-receive-change-regression.log、role-ammo-receive-types.log；npm run test:combat:ammo-receive、npm run test:combat:ammo-change、npx tsc --noEmit通过。生产接入和确认产生条件仍需另行恢复。

有UI的428cd2完整入口16组已执行：UI不存在时跳过所有查找；UI存在时先取virtual+20 selector0，空返回直接结束；有效快捷槽指针后按消息+10查库存，命中用record+c表ID查ItemTable，缺库存用真实43bdbd查询默认2001；查到库存但定义缺失时不退回默认。定义缺失直接结束，保持+54/+9c和确认观察者不变。定义存在先把ItemTable+74传给角色visual virtual+a4，再复制原名称、按localized key0x248格式更新UI virtual+8，之后才进入确认时长段。visual/UI回调时的+54/+9c仍为旧值，与共享顺序逐项一致。

原执行在数组有效时使用真实4327ac，在空getter时通过虚调用边界供给0；库存/表查找、localized format选择、CRT格式化、visual/UI终端及分配/释放供给，真实43bdbd默认分派、413c74资源getter与原字符串构造/复制/赋值/析构执行。短ASCII名称Ammo用于字节对照，原默认format的GBK字节保留在uiFormatBytes；不据此宣称所有名称编码、本地化或UI像素完成。

role-ammo-change-ui.ts恢复门禁、库存命中/默认2001查找和字段/提示更新顺序；receiveRoleAmmoChange在解码后可执行该UI流程，失败时不调用确认时钟/通知、不覆盖时长。16组UI分支共享对照、400组无UI通知、800组原codec链均通过（role-ammo-change-native.json的uiRows/uiFormatBytes、role-ammo-change-suite.log、role-ammo-change-ui-native.log、role-ammo-change-ui-types.log）；命令npm run test:combat:ammo-change、npx tsc --noEmit。原三/四部件virtual+a4均为4661c9。它先取得动作名03的interned ID，再把参数按signed32格式化为_root\online\%.3d，取得该效果名字ID；查role+1f0的动作03与attack1事件，缺任一项不写。真实464c05由begin/end计算记录数，每条跨度294字节，只重写记录首DWORD（效果名ID），其余字段保留；全部attack1记录被覆盖，不是替换战车模型。%.3d是至少三位数字精度，负号独立，2001不截断为三位。84组完整原4661c9覆盖两查找有/无、记录数0/1/3及七参数（含高位signed），逐项验证全部首DWORD与其余字节不变。CRT格式化、字符串intern与动作/事件map查找为供给边界；原循环及464c05实际执行。

apps/web/src/assets/tanks/role-ammo-visual.ts恢复效果名与03/attack1覆盖范围。TankView.setAmmoAttackEffect保存角色独立覆盖，EffectRuntime正式动作消息分派读取它并替换每条记录的效果引用，保留tag/method和其他事件；覆盖不修改共享ELK资源，角色退出后随TankView回收。原UI准备回调命名为updateAttackEffect，可直接绑定该TankView方法。生产确认消息尚未调用此适配，不把模块接入宣称为完整真实弹药切换。

原ItemTable loader的439c06–439c5a三次循环已对204源行执行：列8/12/16的Effect1/2/3分别写record+74/+78/+7c，Tag列9/13/17写+80/+84/+88，Method列10/14/18写+8c/+90/+94，Sound列11/15/19传入+98开始的三个字符串。实际数值赋值与循环执行，表列读取和声音字符串赋值为供给边界。612槽的效果/Tag/Method/Sound逐项与源表一致；有负Tag时按原DWORD存储核对，发布目录保留signed源列值。

combat-catalog.json现发布所有204物件的三组effects字段，供客户端/服务器共同读取，不赋予物品或施放。roleAmmoUiDefinition只解析实际定义的Effect1为确认显示field74，缺定义/缺效果来源返回缺失，不补effect0。普通炮弹2001的Effect1=4、原名称普通炮弹，真实效果目录存在_root\online\004（id1634130525，五个子引用）；不把2001当效果编号，也不直接把skill2001效果槽替代物件Effect1。全部204定义/612槽及确认解析与原循环逐项一致（item-effects-native.json、item-effects-native.log、item-effects-export.log、item-effects-suite.log）。命令npm run assets:combat、npm run test:combat:item-effects；确认/显示回归及类型检查见item-effects-confirmation.log、item-effects-visual.log、item-effects-types.log。


验证：npm run test:combat:ammo-visual、npm run test:combat:ammo-change、npx tsc --noEmit、npm run build。证据role-ammo-visual-native.json、role-ammo-visual-native.log、role-ammo-visual-suite.log、role-ammo-visual-types.log、role-ammo-visual-build.log。有确认后的实际网页提示与显示、效果资产可用性/像素、生产消息及耗弹/补弹仍待接通，M2-02未勾选。



验证：npm run test:combat:ammo-change、npx tsx recovery/evidence/attributes/role-recompute.cts、npm run test:combat:fire-reload、npx tsx tests/world-role-attributes.cts、npm run test:cpu、npx tsc --noEmit。证据role-ammo-change-native.json、role-ammo-change-native.log、role-ammo-change-suite.log、role-ammo-change-recompute.log、role-ammo-change-fire.log、role-ammo-change-world.log、role-ammo-change-cpu.log、role-ammo-change-types.log。实际UI/visual适配、消息+c语义、确认产生条件/生产消息、全部特殊弹药及扣弹/补弹仍待恢复；M2-02保持未勾选。


## 当前弹量赋值与真实待同步位

原432528 selector4直接写OdlPlayer+44的32位m_iBullet，随后record virtual+24通知属性8，返回true；缺record返回false且不写入/不通知。它不检查MaxBullet(+38)、不限制负值/超大值、不比较是否变化、不触发耗弹/补弹、不改变role+2b4重算dirty。基础getter432349 selector4与联网getter422b44 selector4保留全部32位返回；reload通知只比较这个DWORD是否恰为1。

RoleCombatState.setBulletCount/get bulletCount恢复该合同，写入以unsigned32保存，通知回调同步读取已写入值；数字记录缺失时明确返回false，不为不完整接收记录创建默认字段。World默认弹药装填通知现在通过该getter取得弹量。没有调用setBulletCount模拟服务端扣弹/补弹，也没有用普通开火事件自动减一，当前生产来源仍为原构造的0；实际弹量消息到达和原服务端发射/补弹条件是M2-02剩余业务。

验证：npm run test:combat:bullet-count、npm run test:combat:state、npx tsx tests/world-role-attributes.cts、npx tsc --noEmit。128组完整原setter/两个完整getter执行，覆盖record存在/缺失、dirty0/1、旧值0/1/5/ffffffff、新值0/1/2/5/99/7fffffff/80000000/ffffffff。通知实际执行521e8a→虚拟getter522ba2→529a10，无stub，待同步位逐值为属性8、缺record无位，record其他字节和重算dirty保持；输入即使超过显式MaxBullet3也不限制，相同旧/新值仍通知。共享模块逐字段、通知时刻、pending及dirty一致，并与已恢复装填通知组合核验仅1走role+54。正式World126组原属性/21战车开火与再战/明确导入CPU普通输入对局回归通过，原状态flag/array/生命周期回归通过。

原注册5221a0确定属性8为m_iBullet/type14/record+44、属性5为m_iMaxBullet/type5/record+38，和生命属性12/13共用数字字段实现。16组完整545f10编码保留全部32位，线段为category1/index/大端长度4/大端DWORD；当前弹量按unsigned32解析，最大弹量和生命按signed32解析。92组完整52af80 command5→52a280→53dbd0→545ff0→52a8f0执行覆盖对象ID匹配/不匹配、观察者有/无、八种当前/最大弹量、重复写入、生命/弹量交错与上限/当前值顺序、错误类别/长度及先成功后失败。接收逐段写入并通知，失败保留先前写入；对象不匹配不写。路由识别command5返回true，即使内部接收失败；实际52a280返回值也逐项捕获核验。接收不改变原八字pending位或属性发送快照。

共享role-numeric-property.ts与RoleCombatState.receiveNumericProperties接当前弹量/最大弹量/生命的接收合同，已验证原32字节报文读取→对象ID/command路由→真实角色数字记录→最后一发装填分派。接收不调用赋值setter的发送通知，也不自行设置角色重算dirty；终端业务观察者由调用方提供。弹量为1才取最后一发时长，高位值保持unsigned32。此模块尚未接生产TSRPC属性消息，原服务器弹量生产与补弹条件待恢复。

完整原42f385在阶段1直接退出；其余阶段按传入record+c的对象ID查角色，缺角色退出。属性5与8共同进入42f5a3，只有当前角色等于owner+3c且owner+68观察者存在时，先执行实际联网整数getter24→record+38，再执行getter4→record+44，向observer virtual+8报告参数(当前弹量,最大弹量)。远端角色不报告，不查MaxBullet夹取当前值，不扣弹/补弹，不修改任何角色或记录字段。2,592组完整入口验证六阶段、角色有/无、本机/远端、观察者有/无、属性5/8/9、六当前值及三上限，完整角色/记录内存保持。阶段getter、角色查找与最终观察者为供给边界；真实字段getter53ff90、422b44/432349执行。

role-ammo-observer.ts接原门禁与当前/上限参数，已与数字接收组合确认每段写入后报告。RoleAttributeState在原重算的publish阶段把record+38/+58同步到实际RoleCombatState数字记录，在移动/完成通知之前可由getter读取；保留当前弹量与当前HP，不为缺失数字记录补造字段。564组完整重算的通知时刻及最终字段、254组缺来源不写，World126组真实拥有来源、21战车开火/再战与CPU自然对局通过。此补齐不改变服务端扣弹/补弹来源。


验证：npm run test:combat:bullet-receive、npm run test:combat:ammo-observer、npx tsx recovery/evidence/attributes/role-recompute.cts、npx tsx tests/role-health.cts、npm run test:combat:state、npx tsx tests/world-role-attributes.cts、npm run test:cpu、npx tsc --noEmit通过。五模式CPU各两轮经普通输入完成，准备/冻结结算/再战/退出回归通过。

证据role-bullet-count-native.json及其所列日志；role-properties-native.json的bulletWireRows/bulletReceiveRows、role-ammo-receive-final.log、role-ammo-receive-suite.log、role-ammo-observer-native.json、role-ammo-observer-native.log、role-ammo-observer-suite.log、role-ammo-recompute-suite.log、role-ammo-world-suite.log、role-ammo-cpu-suite.log、role-ammo-types.log、role-ammo-health-suite.log、role-bullet-receive-health.log、role-bullet-receive-state.log、role-bullet-receive-world.log、role-bullet-receive-cpu.log、role-bullet-receive-types.log。原getter/赋值/接收合同不证明原服务器何时发射消耗或补满；M2-02保持未勾选。


## 原开火通知的当前弹量分派

完整原423092通过联网整数getter422b44→432349 selector4读取OdlPlayer+44的m_iBullet；恰好为1才取float selector23→role+54，其余signed值取selector24→role+50。该条件不是弹药快捷槽，也不是ItemType。两个float值是完整重算/网络覆盖的角色时长字段；因旧计算测试称第二值type1Seconds，不能据此把“1”解释为特殊弹种。共享applyRoleFireReloadNotification恢复该分派，duration先转float32，relativeClock可为double，加法结果再存f32 deadline。

只有通知角色等于manager+3c当前本机角色时才更新deadline：先取时钟，后通知可选manager+7c时长观察者，再调用可选manager+cc本机完成回调参数0。无论是否本机，最后均转发manager+8c角色/技能编号回调；远端通知不调用时钟、不改本机deadline、不触发本机回调。原完整函数含实际基础/联网整数getter、实际float getter执行，与共享顺序及数值一致。

正式World完整来源非VIP默认弹药路径现调用该已验证合同，取真实生产numericFields+44当前值和完整计算role+50/+54。当前生产m_iBullet仍为原初值0，耗弹/补弹与角色弹量消息链尚未恢复，因此目前该路径仍选普通时长；不能通过选择快捷槽或给夹具赋值假称真实最后一发装填已完成。其他弹药/VIP/缺来源路径仍明确保持原型，M2-02继续未勾选。

验证：npm run test:combat:fire-reload、npm run test:combat:reload、npx tsx tests/world-role-attributes.cts、npx tsc --noEmit。96组完整原423092涵盖本机/远端、弹量0/1/2/5/高位unsigned/ffffffff、两观察者有无和两个double时钟，实际deadline与完整事件顺序逐项一致。时钟返回和观察者末端为供给边界，未替换原分派/原getter。已恢复装填限制/累加回归通过；正式World126组属性、21战车普通开火/再战及明确导入CPU对局回归通过。证据role-fire-reload-native.json、role-fire-reload-native.log、role-fire-reload-suite.log、role-fire-reload-regression.log、role-fire-reload-world.log、role-fire-reload-types.log。


## 完整拥有来源的World权威重算

World角色现持有RoleAttributeState与attributesReady。recomputeAttributes读取房间独立拥有记录、正式21战车/10宠物定义、生产数字字段和真实16技能/五部件表ID数组，向完整recompute提供正式SkillTable/ItemTable/datascale、已证实的role+24初值/当前计数、静态移动尺度和原实例查询回调。独立boundGear没有由账户路径确立，保持空；完整原433466允许空boundGear，不把它作为七来源必需门禁。两类拥有记录/表定义或所需记录字段缺失则不计算，不用undefined|0合成假来源。每次替换拥有来源先使attributesReady失效；先前计算值可保留用于诊断但不能作为有效游戏数值使用。

WAITING绑定拥有记录、确认资料或有效部件定义变化会调用完整重算；开局按当前VIP状态重算一次。非VIP且来源完整时，开局/复活生命和快照MaxHP取原record+58，默认弹药开火的deadline取原role+50普通装填；当前HP在重算本身保持不变，开局/复活由生命周期显式恢复。再战重新计算并恢复生命，普通开火走原flag11和float32时钟比较。未装配完整来源的角色/CPU维持现有明确原型规则，不自动赠送拥有记录。VIP原倍率和特殊弹药的完整选择尚未恢复，因此这些路径仍保留原型，不以特殊弹药仍为800ms推定原规则。

计算的攻防/移动等字段现有完整状态和dirty合同，但伤害公式、移动碰撞与属性广播尚未替换，最大弹量的全部开火/耗弹规则尚未接入。帽子/气球和复制技能字段目前使用已确认生产初值，后续装备/技能授予事件、独立拥有技能绑定及role计数更新仍需恢复；本阶段不宣称所有装备/技能账户值正确。

验证：npm run test:combat:world-attributes、npm run test:accounts、npm run test:cpu、npx tsc --noEmit。world-role-attributes-native.py在原完整433466上执行21战车×空/五类部件共126组，源记录为明确导入夹具，计数/复制技能/帽子气球为原生产初值、16槽为空、boundGear为空；资源查找供给，完整技能累加/边界/精通/转换、原移动setter和dirty执行。World经正常拥有来源/库存/确认资料入口组装，全部recordFields/roleIntegers/roleFloats逐值匹配原结果。21战车经普通输入真实开火，验证每次间隔在原装填到下一50ms步之间、开局及再战HP/MaxHP匹配。三CPU明确导入拥有来源后沿普通移动/开火输入自然结束，产生实际开火和命中；不注入位置、伤害或终局。缺来源和不完整记录失效通过。完整账户/网络与五模式CPU各两轮回归通过。

证据：world-role-attributes-native.json、world-role-attributes.json、world-role-attributes-native.log、world-role-attributes-suite.log、world-role-attributes-accounts.log、world-role-attributes-cpu.log、world-role-attributes-types.log。M2-01/M2-02仍未勾选，实际伤害、全部技能/装备来源、属性广播、VIP、特殊弹药和移动规则验收继续按清单执行。


## 生产角色数字记录与计数初值

createRoleRecordNumericDefaults对应原OdlPlayer构造523333–52339b的27个数字字段：LV(+10)=1、sex byte(+34)=1、当前弹药选择(+3c)=1、当前弹药表ID(+40)=2001，其余已写入数字字段为0，包括复制技能/等级(+88/+8c)、帽子/气球(+6c/+70)、生命/上限、战车/宠物表ID及状态。浮点+48/+4c清零；byte+34/+50仅按字节读取，不把原保留padding认成高位数据。昵称、wrapper/metadata与数组的初始化不由此数字片段证明；既有数组/属性声明证据仍独立。

RoleCombatState的正常生产工厂现持有这些独立数字字段；attributeSourceFields返回数字字段副本、当前真实status及实际数组2对应+bc..+cc五个ItemTableID。缺role record或外部记录未提供数字字段时返回undefined，不用数字默认值补造接收来源。World.roleSkillSources只在拥有战车记录和数字来源存在时调用已恢复readRoleSkillSources，取得当前16槽、拥有战车三个固定物件表ID、实际五部件表ID、复制技能/等级及帽子/气球两道具值；独立boundGear尚未由账户链确立，保持undefined，不把选中宠物当该对象。

角色基础构造431bed调用41d7a6(role+4)，后者实际41d76e清零18个DWORD，包含role+24。RoleCombatState.recomputeCounter因此初值为0。实际基础getter432417 selector9和联网覆盖422b64 selector9均读到该0；此处只证明初值，不恢复该计数在对局中的所有更新事件，不把它命名为等级/击杀/分数。

ROLE_INITIAL_MOVEMENT_SCALES发布当前EXE静态地址61e494/61e498的float32值10和0.06981316953897476。这些地址由既有完整精通尾段433b3b等直接读取；本轮不宣称证明后续没有间接写入或全部资源初始化，因此现有World移动尺度和完整重算仍保持待恢复，不直接用该常量替换移动规则。

验证：npm run test:combat:defaults、npm run test:combat:state、npm run test:accounts:sources、npx tsc --noEmit。四种预填内存0/55/aa/ff执行原数字初始化片段、完整41d7a6/41d76e及基础/联网getter9，无原函数stub；供给边界仅数字片段入口的构造寄存器和对象/记录布局。逐项对照27字段，确认数组区未在数字片段初始化。共享生产技能字段读取、table-ID部件数组、数字副本隔离及缺数字记录保留通过；World来源组合、210战车/宠物来源、32资料与204物品/74原技能选择回归通过；323flag/28array/8生命周期/868技能变更及普通开火死亡复活/再战回归通过。证据role-record-defaults-native.json、role-record-defaults-native.log、role-record-defaults-suite.log、role-record-defaults-state.log、role-record-defaults-accounts.log、role-record-defaults-types.log。

M2-01/M2-02仍未完成：完整拥有技能/独立装备绑定、全部属性输入与权威重算、伤害公式、真实生命与装填仍需接入。本轮恢复了生产初值和字段来源，不把初值来源当作所有对局属性已正确。


## 从角色装配字段读取完整技能来源

readRoleSkillSources恢复完整4335b5–4337d7的来源字段读取：当前16技能槽独立传入；绑定装备（角色+a0由真实getter4227d8返回）的+44..+58六项baseId及+5c..+70六项rank组成六组技能；角色记录+88/+8c为额外技能；第二拥有来源+58/+5c/+60与角色记录+bc/+c0/+c4/+c8/+cc/+70/+6c合成十个有序道具ID。各DWORD按signed32读取，与既有原技能选择模块的组合键一致。

角色绑定装备+a0是独立对象入口，真实getter4227d8返回该字段；共享接口显式接收boundGear。界面管理器4234d7设置globalGame+118对象的回调，不是角色装备setter。当前模块不推断装备归属或自动绑定。548组原完整重算fixture保存执行前实际字段，共享直接读这些字段，再进入正式表绑定/完整重算/持有状态，全部来源顺序、最终值及通知状态一致。

验证：recovery/.venv/bin/python recovery/evidence/attributes/role-recompute-native.py、npx tsx recovery/evidence/attributes/role-recompute.cts、npx tsc --noEmit通过；role-recompute-native.json的sourceFields、role-skill-sources-native.log、role-skill-sources-suite.log、role-skill-sources-types.log。绑定装备对象的构造/账户装配及World调用仍待完成，M2-01/M2-02保持未勾选。


## 角色初始化门禁与拥有记录生命周期入口

基础角色vtable5c41b8的virtual+3c为43291e：仅当role+2a0角色记录、+a0第一绑定拥有记录及+a4第二绑定拥有记录全部非零时返回0，否则返回1。needsRoleInitialization恢复基础类三个引用门禁，8种完整原函数执行与共享对照一致。联网角色使用派生类覆盖门禁，见下段；不能将基础门禁直接套用于网络建立。

角色析构433e26–433e63对+a0执行41e9c7后释放、对+a4执行421f61后释放，分别对应第一/第二拥有记录类；此处仅指令定位，不证明绑定赋值/复制合同。4234d7的直接调用者4d4423设置globalGame+118界面管理器回调，其来源4ce21e是界面业务，不用于推断角色+a0装配。实际拥有记录构造/绑定入口及账户装配仍待恢复。

验证：recovery/.venv/bin/python tests/role-initialization-native.py、npx tsx tests/role-initialization.cts、npx tsc --noEmit；role-initialization-native.json、role-initialization-types.log。M2-01/M2-02保持未勾选。

联网角色管理器主vtable5c3a18的virtual+30为422ea4，分配370hex后调用派生构造42275e；virtual+44为创建/绑定/入索引包装4231fc。次接口位于owner+8，vtable5c3a10。派生构造先调用431bcf，再在422784设置role vtable5c2c28。该表virtual+3c指向422ba6：仅检查role+2a0，存在返回0，否则1；virtual+54/+58仍使用4227d8/4227df，virtual+74仍为完整433466。needsBattleRoleInitialization单独恢复联网角色门禁。

原422ea4/42275e已实际执行，分配和基础构造供给，随后读取所设真实vtable验证覆盖函数；不会把供给基础构造当完整基础初始化验收。8种角色/两拥有引用组合执行完整422ba6，再经实际426558–42656b虚表分派：只要角色记录存在，即调用owner virtual+48，拥有引用是否为空不影响；该owner初始化回调作为边界供给。基础门禁8组仍独立验证。此创建门禁与本机观察者重算来源是不同入口：来源基础/装备由管理器+20/+24供给，而+a0仍是可选的六组装备技能读取对象。

验证：battle-role-initialization-native.log、battle-role-initialization-suite.log、battle-role-initialization-types.log；role-initialization-native.json的battleFactory/battleConstructor/battleVtable/battleGate/battleRows。实际owner初始化/渲染对象创建、装备技能绑定与账户装配仍待完成；不将+a0/+a4作为联网角色初始化的必需条件。



## 成对拥有记录消息0x3aa5

原getter42cd5c返回3aa5。完整reader42ccd9先分配70hex/执行421ec2构造，将第二来源记录存message+c；再分配98hex/执行41e90e，将第一来源记录存message+10。随后依次421afe读取第二来源、41e5f1读取第一来源，不带批量计数。共享readOwnedRolePairMessage恢复此线路顺序；第二来源单记录位流reader提取为readOwnedRoleEquipmentPacket并由既有批量解析复用。

16组完整原函数执行覆盖全部8种位对齐、两类原完整记录字段与空/非空/非ASCII名称字节，核验真实构造后字段、两份名称、栈返回和最终游标；分配/释放/字符串存储边界供给。共享逐字段/名称字节/游标匹配；既有第二来源批量、双表消息与容量分支回归通过。该消息的监听器与管理器引用接收已恢复，合同见下段；拥有引用到战斗角色+a0/+a4的绑定尚未证明。

验证：recovery/.venv/bin/python recovery/evidence/roles/role-owned-pair-native.py、npx tsx recovery/evidence/roles/role-owned-pair.cts、npx tsx recovery/evidence/roles/role-owned-equipment.cts、npx tsc --noEmit通过；role-owned-pair-native.json、role-owned-pair-suite.log、role-owned-pair-batch-regression.log、role-owned-pair-types.log。M2-01/M2-02保持未勾选。

原监听器管理器构造42b7e7在42b8bb调用423a06，静态监听器6353e8使用vtable5c2db0；vtable+4是factory42cc3f、+c是type getter42cd5c。注册时handler为422f66，真实48baff将其以3aa5插入注册树。完整构造执行覆盖23种监听器，真实4501fa查出3aa5对应对象及handler；供给边界仅分配578620和退出析构调度57aa66。

完整422f66依次把message+10基础记录存this+20，再把message+c装备记录存this+24，ret0xc；不清空消息字段、不释放旧引用、不通知或重算。16组引用值（含null）验证覆盖替换与清空，消息内容和相邻管理器字段保持原值。receiveRoleOwnedPair按此顺序保存同一对象引用；16组真实成对载荷经解析→接收→stage3/4来源getter取回同一对象，随后进入既有完整重算/RoleAttributeState对照，共564组结果继续一致。阶段2仍使用拥有实例查找，不由该回调改变。

验证：npm run test:combat:health、npx tsc --noEmit；role-owned-receive-native.json、role-owned-receive-suite.log、role-owned-receive-types.log。仅证明监听器注册/查找、管理器来源引用接收与共享计算组合；socket接收外层、管理器到战斗角色+a0/+a4绑定及账户装配/World权威调用仍待完成。


## 成对拥有消息到完整角色属性计算组合

完整433466原执行fixture新增16组使用0x3aa5完整reader取证输出的两类拥有字段，进入真实原初始化/技能/道具/限制/精通/转换/通知/dirty链。共享从原成对载荷直接readOwnedRolePairMessage解析后，进入正式表绑定、技能来源读取、完整重算及RoleAttributeState持有属性，并重复重算。原函数与共享共564组最终全部字段、中间通知和dirty一致。

这16组显式设置测试角色技能槽/装备/道具/角色值，第二记录+34与三个道具位置按夹具设置，战车/宠物来自正式表；不会把实验装配当原账户来源或默认配置。接收handler422f66到管理器+20/+24的引用保存已恢复；管理器到战斗角色+a0/+a4的绑定及该组合的World接入仍未完成。

验证：recovery/.venv/bin/python recovery/evidence/attributes/role-recompute-native.py、npx tsx recovery/evidence/attributes/role-recompute.cts、npx tsc --noEmit通过；role-recompute-native.json的ownedPairIndex、role-owned-pair-recompute-native.log、role-owned-pair-recompute-suite.log、role-owned-pair-recompute-types.log。M2-01/M2-02继续未勾选。


## 完整重算的七来源前置条件

原433466–4334e8依次检查五个参数base/equipment/SkillTable/ItemTable/itemResolver，再检查role+2a8战车表和role+2a4宠物表。首个缺失来源经诊断返回ret20，不进入基础初始化，不写属性或dirty。共享missingRoleRecomputeSource返回同顺序的首个缺失来源；此处来源是显式已解析对象，不能将null检查用默认记录替代。

128种完整存在/缺失组合执行原前置段，缺失时执行实际早退尾部，供给诊断日志边界；全部存在时停止于初始化入口4334e8。逐例校验首个诊断来源、全角色400hex字节未修改，缺失路径栈ret20正确。共享逐例匹配；该判断尚未由World调用，装配入口和引用转移仍未确认。

验证：recovery/.venv/bin/python recovery/evidence/attributes/role-recompute-readiness-native.py、npx tsx recovery/evidence/attributes/role-recompute-readiness.cts、npx tsc --noEmit通过；role-recompute-readiness-native.json、role-recompute-readiness-suite.log、role-recompute-readiness-types.log。M2-01/M2-02保持未勾选。


RoleAttributeState.recompute正式使用missingRoleRecomputeSource，在同步dirty或初始化属性之前按七来源顺序检查。RoleAttributeInput显式允许基础/装备/技能表/道具表/战车/宠物及第五参数缺失；第五参数由调用者明确提供，不设替代函数，实际计算仍不调用它。任一来源缺失返回false，已有values对象、记录hp/maxHp/maxBullet/move/turn、八字propertyDirty及角色/属性dirty保持调用前原值，不发通知；全部来源具备仍执行原计算。

原128组门禁取证同时保存角色和所引用记录全部字节，确认早退无两者写入。共享127种缺失组合分别从空属性/已计算属性调用，共254组保留合同；故意设置属性dirty与角色dirty不同，核验门禁先于dirty同步。564组来源完整计算、缺失技能数组初始化后早退、技能观察者组合继续通过。验证：role-state-readiness-native.log、role-state-readiness-suite.log、role-state-readiness-types.log；npx tsx recovery/evidence/attributes/role-recompute.cts、npx tsc --noEmit。仅模块入口接入，账户与World仍待完成。


## 本机技能观察者到完整属性重算入口

原property31观察者在42f808比较当前角色与owner+3c；只有本机角色执行42f811–42f846。入口调用角色virtual+28(selector3,value1)设置重算dirty，然后依次取原ItemTable、SkillTable、owner装备来源427bf9和基础来源427ba2，以五个参数调用角色virtual+74（完整433466）；第五个参数是实际422dfd。此入口不调用43291e初始化门禁，不能把+a0/+a4三引用门禁当成本机重算的调用前提。绑定装备+a0仍独立影响六组装备技能来源。

564组完整重算夹具各自先运行直接433466，再恢复全部角色/记录初值、清属性pending，执行真实422f66接收引用及42f808–42f846入口。角色vtable+28使用432738、+74使用433466；真实413c65/413c74、427ba2/427bf9和4269c4继续执行，stage getter供给3或4。每组两条链的全部属性、技能累加、移动/尾部通知、八字属性dirty和角色重算dirty完全相同，含缺失技能数组的初始化后早退；不存在替换重算函数的边界。此取证从本机分支比较开始，不代替此前完整观察者的角色查找/技能停止/旧槽复制验收。

RoleAttributeState.recompute接受明确RoleCombatState时读取同一角色dirty，通知期间保持dirty，完整计算通知后同步清除两个状态；初始化后早退仍保留dirty。共享564组技能槽观察者→真实属性计算/状态持有组合核验所有属性、通知时刻与dirty，未使用finishRecompute代替计算。

验证：recovery/.venv/bin/python recovery/evidence/attributes/role-recompute-native.py、npx tsx recovery/evidence/attributes/role-recompute.cts、npx tsc --noEmit通过；role-recompute-native.json的observerStage、role-observer-recompute-native.log、role-observer-recompute-suite.log、role-observer-recompute-types.log。角色/资源表及拥有对象由已验证来源夹具准备；实际账户装配、装备绑定、网络属性广播与World权威接入仍待完成。


## 原道具实例查询回调与重算表ID的区别

原422dfd是cdecl回调，读取第二参数实例ID，忽略第一参数；通过globalGame+120库存管理器调用真实43d728。该函数依次调用43d186、43d1a5、43cd5b，按vector10/20/30/40/60/70查record+4实例ID，vector50/80不参与，首个匹配立即返回。422dfd读取所得record+c表ID，通过实际413c74取得ItemTable后调用411068；实例缺失返回null，表缺失返回查表null。返回不清除两个参数，调用者负责清栈。

3264组原完整执行覆盖全部204个源道具、八分组、表存在/缺失及三种unsigned实例ID；真实六vector搜索与413c74执行，表查找411068供给。额外所有分组同实例验证首个支持vector获胜。共享resolveRoleItemInstance按相同搜索顺序返回表对象本身，缺失分组/实例/表均匹配原结果；不推定拥有数量决定查表资格。

完整433466在4334a6仅检查第五参数非零；433582覆盖参数槽ebp+18存累加器，此后使用该槽作为精通累加器。实际十个道具来源在4336eb–4337d2直接经ItemTable查表，未调用第五参数。因此readRoleSkillSources.itemIds在此路径保存表ID，不通过resolveRoleItemInstance转换。564组原本机观察者入口继续传实际422dfd，回调执行监视断言从未触发，全部完整计算对照保持相同。该回调用于实例查询的合同独立保留，不能因它出现在参数中而替换重算规则。

验证：npm run test:combat:inventory、recovery/.venv/bin/python recovery/evidence/attributes/role-recompute-native.py、npx tsc --noEmit；role-item-resolver-native.json、role-item-resolver-suite.log、role-item-resolver-recompute.log。仍不证明World道具实际施放或账户战车/宠物装配；M2-01/M2-02/M4-03保持未勾选。


## 已拥有实例到宠物/战车定义

原41e9f1在base拥有索引按实例查找，节点miss或记录null返回null；实际413c83取得PetTable，管理器null返回null；读取拥有记录+8，以该表ID调用411068并返回定义。原421f88同样在equipment拥有索引查实例，经实际413c95取得TankTable，再读记录+24查定义。两函数ret4，不写拥有记录，也不改变装备选择。base是宠物拥有类的数值来源，equipment是战车拥有类的数值来源；既有偏移字段名称仍按来源保存。

1984组完整两函数执行覆盖10宠物/21战车、四种unsigned实例ID及拥有节点/记录/表管理器/定义存在与缺失分支；真实全局getter执行，节点搜索4501fa和表查找411068供给。共享resolveOwnedRolePet/resolveOwnedRoleTank使用原字段，逐组返回正式服务端定义对象，与原查表顺序和null分支一致。

16组持久化成对载荷测试明确将base+8/equipment+24设为完整重算夹具所用宠物/战车定义，再经账户保存/读回、原实例映射核验正式来源，继续走管理器引用接收与564组属性对照。此字段设置仅实验装配，原成对消息解析字段独立测试保持原样；不从表目录赋予玩家拥有权，也未实现选择请求/装卸许可。

验证：recovery/.venv/bin/python recovery/evidence/roles/role-owned-definition-native.py、npx tsx recovery/evidence/roles/role-owned-definition.cts、npx tsx recovery/evidence/attributes/role-recompute.cts、npx tsc --noEmit通过；role-owned-definition-native.json、role-owned-definition-recompute.log、role-owned-definition-types.log。M6-01/M2-01/M2-02继续未勾选，实际装配业务和World仍待接入。


## 玩家资料已选宠物/战车实例字段

玩家资料包装42fdc5的selector28/29转交42029e，读包装内记录+84/+88；这些值正是stage2重算来源getter427ba2/427bf9传入拥有索引的实例键。包装setter42fdea对同selector转交420551，在420719/420724直接写两个DWORD，返回al1、ret8，不发通知、不查归属、不重算。已有值相等也执行写入；零值及高位uint32保留。

8组完整包装setter/getter执行核验全190hex字节只有目标字段改变；96组已有stage/实例来源测试改为经真实setter准备资料，再执行原getter/拥有来源查找。共享readRoleProfileSelection/setRoleProfileSelection与原字段写入、读取和96组来源结果一致。16组持久拥有记录的preview查询也明确经共享资料字段选择，不把账户查询自动选中首条记录。

验证：recovery/.venv/bin/python recovery/evidence/roles/role-recompute-sources-native.py、npx tsx recovery/evidence/roles/role-recompute-sources.cts、npx tsx tests/account-role-records.cts、npx tsc --noEmit；role-recompute-sources-native.json的selectionRows、role-profile-selection-suite.log、role-profile-selection-account.log、role-profile-selection-types.log。此setter是原资料字段操作，不是权限接口；真实选择请求、确认、选择保存及World应用仍属M6-01未完成范围。


## 玩家资料变更确认3ab7

真实监听器42b7e7将3ab7绑定到4249b6。该入口读取message+17c结果，仅结果1调用424908以message+c作为来源复制到owner+40内包装+20；随后owner+64回调存在时virtual+8报告结果，其他结果不写资料但仍报告。完整复制424908与内部4209fb覆盖包装header+4/+8/+c、byte10、+14/+18/+1c，两字符串（payload+20/+3c）以及内记录字段、32字节区域和7/3/5/3数组、尾部byte168/169/16a及DWORD16c。vtable、未复制头字段和填充保持旧值。资料中的已选宠物/战车实例也在本次复制范围。

48组原完整确认/复制执行覆盖结果0至5、回调有无及四种全字段字节输入；只供给字符串4014c9存储和界面回调，全部数值/数组复制及分派实际执行。核验整个170hex payload字节、两字符串、来源不变及界面回调观察到的最终资料。共享applyRoleProfileConfirmation保留原选择性复制与成功/失败合同，逐字节及通知时机一致。字符串对象按两条逻辑string独立表示，原存储对象字节不当文本暴露。

验证：recovery/.venv/bin/python recovery/evidence/roles/role-profile-confirmation-native.py、npx tsx recovery/evidence/roles/role-profile-confirmation.cts、npx tsc --noEmit；role-profile-confirmation-native.json、role-profile-confirmation-suite.log、role-profile-confirmation-types.log。该回包是完整玩家资料变更确认，不单凭已选字段存在推断它只用于装备选择；请求产生、资格校验、账户写入和World应用仍待恢复。


## 联网角色完整到达与记录绑定

管理器构造片段42f9bb–42f9cf设置主虚表5c3a18及owner+8的次虚表5c3a10。主virtual+30为422ea4工厂，virtual+44为4231fc包装，virtual+3c为421673入索引，virtual+48为422fb1渲染初始化。role-initialization-native.py按实际主虚表验证两入口；原联网角色门禁422ba6及角色虚表5c2c28不变。

完整4264c4先调用角色记录virtual+44，即真实52273e，将globalGame+c0保存到record+8；随后按record+c对象ID查找现有角色。未命中时经实际4231fc调用工厂、431d5c绑定记录并调用入索引；命中时直接431d5c更换记录。setter保存role+2a0并缓存record+c到role+2ac。随后读取record+78/+68，按宠物、战车顺序查表；命中写role+2a4/+2a8，缺失保留旧引用。对象ID等于globalGame+114所指状态+6c时，先将owner+3c设为该角色，再执行422ba6门禁与渲染初始化；之后执行本机选择42300f，最后经真实43293d读取record+90状态并交给4259ae。

完整入口更新不写role+a0/+a4，已有独立拥有引用保持不变；新建夹具的基础构造由边界供给，不能据此宣称全部角色绑定始终为空。3aa5处理器保存的manager+20/+24与角色独立绑定仍是不同来源。本入口的名称为属性对象到达，不把已解码记录当作另一个3aa消息reader。完整属性对象解析由role-properties-native.py覆盖，账户生成该对象的装配及World权威重算仍待接入。

共享receiveBattleRole实现完整到达顺序，存储record+8、角色记录引用和对象ID；复用bindRoleSourceTables，保留查表缺失时的既有定义。创建/索引、渲染初始化、本机选择和生命周期通过显式边界回调调用，未接入正式World。64组原执行覆盖创建/更新、本机/其他角色、两表独立命中/缺失及四状态，逐项比较共享回调顺序、资料引用、定义保留、独立拥有引用保留和本机标记；record准备、工厂/派生构造、记录setter、真实表服务getter、初始化门禁和状态getter都执行原指令。基础构造、堆分配、索引查找/插入、表查找、渲染及最终状态分派为供给边界。

验证：recovery/.venv/bin/python tests/battle-role-receive-native.py、npx tsx tests/battle-role-receive.cts、recovery/.venv/bin/python tests/role-initialization-native.py、npx tsx tests/role-initialization.cts、npx tsx recovery/evidence/attributes/role-recompute.cts、npx tsc --noEmit。证据battle-role-receive-native.json、battle-role-receive-native.log、battle-role-receive-suite.log、battle-role-receive-types.log、battle-role-receive-recompute.log、battle-role-initialization-native.log/suite.log。
