# 原技能函数开发范围

来源：原skill.dat的342条技能、item.dat的204条道具。`recovery/.venv/bin/python recovery/export_skill_function_coverage.py`重建skill-function-coverage.json；`npm run assets:combat`发布供服务器/Web共同读取的combat-catalog.json。

源表共有1026个函数槽：684个type0槽、342个非零槽，非零类型1–23。下表的技能数量跨类型可能重叠；type6在两条技能中共三个槽。类型编号与描述只作为来源索引，尚不证明服务端函数语义。有限生产实现见本文末段与tasklist.md，全部原函数及实际验收仍未完成。

| FuncType | 函数槽数 | 技能数 | 源实例 | 首个实例参数T/X/Y/Z |
| --- | --- | --- | --- | --- |
| 0 | 684 | 342 | 1 宠物饲料 | 0/0/0/0 |
| 1 | 259 | 259 | 4 营养饮料打很猛 | 10/0/0/0 |
| 2 | 41 | 41 | 1 宠物饲料 | 0/0/0/0 |
| 3 | 3 | 3 | 4001 捕兽夹B | 5/0/0/0 |
| 4 | 3 | 3 | 4002 果酱B | 5/0/0/0 |
| 5 | 2 | 2 | 4003 软木塞B | 5/0/0/0 |
| 6 | 3 | 2 | 8 无敌软星 | 10/0/0/0 |
| 7 | 1 | 1 | 9 隐身装置 | 10/0/0/0 |
| 8 | 2 | 2 | 10 南瓜变变变 | 10/1/0/0 |
| 9 | 1 | 1 | 10221 大麦偷袭 | 0/0/30004/0 |
| 10 | 1 | 1 | 3 宠物注射剂 | 0/0/0/0 |
| 11 | 1 | 1 | 10441 最后一搏 | 3/0/0/0 |
| 12 | 4 | 4 | 3002 地雷 | 30/30/4023/3002 |
| 13 | 1 | 1 | 3001 古老炸弹 | 5/30/3009/3001 |
| 14 | 1 | 1 | 12 扫光光（扫把） | 0/0/0/0 |
| 15 | 6 | 6 | 3007 小型爆炸 | 0/0/3010/0 |
| 16 | 1 | 1 | 13 “救命啊”通讯器 | 0/20/3013/0 |
| 17 | 1 | 1 | 10711 你会我也会 | 0/0/0/0 |
| 18 | 2 | 2 | 501 1UP | 0/1/1/0 |
| 19 | 3 | 3 | 12501 金钱+100% | 0/100/0/0 |
| 20 | 2 | 2 | 20001 鱼骨 | 1/1/20001/0 |
| 21 | 2 | 2 | 13111 雷达干扰装置 | 0/0/1/0 |
| 22 | 1 | 1 | 2022 粒子炮弹 | 0/0/0/0 |
| 23 | 1 | 1 | 2023 火箭炮弹 | 0/200/0/0 |

生产目录现包含Range与原列19–46的28个数值属性，以原列名保留在attributes中，包括正/负HP、攻防、装填、弹量和精通。它们不自动赋予技能、不修改角色或消耗库存。技能1的HP=200、技能19的HP=-100及技能12的Range=400均来自原表；上限、目标、持续及服务器成功条件需分别恢复。

TriggerType现存0/1/2/3/4/5/6/7/8/9/11/12/13/14，Target现存1–6。coverage.json逐槽保留skillId、名称、原trigger/target/range、T/X/Y/Z和关联itemTableIds，runtimeStatus均为unimplemented。 该字段是导出时的来源阶段标记，不能作为当前生产实现状态；正式状态以tasklist.md逐条业务及专题文档为准。

原引用缺口：道具3006引用技能4027，当前skill.dat不存在该记录。缺口单独保留，不替换为4023等相近编号。

每个FUNC子项按函数/目标/参数/持续的具体来源接入权威状态；原服务端入口缺失时按客户端请求、接收确认和表参数采用明确业务规则，详client-communication-business-rules.md。随后仍须用真人或CPU普通输入验收成功、失败、数量及真实事件。原432b29被动筛选和角色重算已有独立模块证据；不作为FuncType1主动施放完成证据。342技能及204道具的全量业务验收继续由M4-10追踪。

FuncType2恢复前置已新增原生命赋值合同：433250 selector15先通过record通知12标记属性待同步，再按signed32限制0..record+58，最后按最终变化触发旧生命回调。共享role-health.ts与120次完整原setter/getter及Life调试格式执行一致（test:combat:health、role-health-native.json）。这不证明FuncType2会调用此setter，也不提供未恢复的目标、增量、授权或消耗条件；FUNC-02保持未勾选。详细字段及顺序见combat-field-inventory.md。

角色原属性注册另证明index12=m_iHP、index13=m_iMaxHP，数值type5绑定record+54/+58。原545d40属性写入直接复制signed32值、不经过433250的限制；applyRoleHealthProperty与20例原写读一致。完整34项注册与绑定均由原构造和元数据引擎执行（role-properties-native.json）；网络外层和函数分派仍未完成，不把属性更新等同于技能成功。

原记录通知521e8a→管理器529a10已恢复256位dirty位图，普通byte索引置对应位、fe置全部8个DWORD、ff不变；512组通知及120组完整生命setter/真实管理器链与共享role-property-dirty.ts一致（role-properties-native.json、role-property-dirty-suite.log）。这是属性待同步标记，不等于立即UI通知或FuncType2施放；FUNC-02继续保持未勾选。

原属性变化检测529a60已与630组真实34属性扫描对照一致；模式1/schemaMode2需要已有dirty位，进入扫描后重建位图，检测不刷新快照。HP/MaxHP的545f10原8字节数值段采用大端长度和signed32值，encodeRoleHealthProperty通过14组原字节对照；发送分支调用的545ee0刷新另已验证。证据role-properties-native.json、role-property-detection-suite.log、role-property-detection-types.log。另已执行原52a280管理器接收、53dbd0段解析、545ff0生命读取及52a8f0观察者转发，42组原链与receiveRoleHealthProperties逐值一致；重复值仍通知，按包中段顺序写入，失败保留已成功段，接收不限制生命或刷新快照。证据role-properties-native.json、role-property-receive-suite.log、role-property-receive-types.log。对象管理器52af80的键/命令分派已通过58组原执行，525630/525730/525830登记表查找及记录类型核对通过48组原执行，见role-property-route.ts和role-property-route-suite.log。命令5无论内部接收成功与否均返回“已处理”，不得以此认定FuncType2成功。真实登记表构造5275f0、模式1/2登记及526a70删除通过15组原操作；18组真实登记表到生命接收的组合与共享role-property-registry.ts一致，见role-property-registry-suite.log。网络事件536b70/536dc0的单个可选观察者转发另通过30项真实登记链原执行，与role-property-events.ts一致（role-property-events-suite.log）。观察者绑定/末端业务、模式1的原525030/529480属性清理另通过3组真实退役及102个实际字段析构，见role-property-cleanup.ts及role-property-cleanup-suite.log；保留角色值、owner、schemaMode与dirty位图。模式2类型工厂归还分派另通过模式0/缺失工厂/正常归还三组，原角色447e29及记录/管理器/34字段析构真实执行（role-property-factory-suite.log）。OdlPlayer真实工厂构造/注册及创建→登记→生命接收→移除归还链另已执行（role-factory-registration-suite.log），本测试单类型编号0不代表完整程序的固定编号。完整528170创建消息另通过6组真实schema/命令3初始生命读取/登记/移除归还执行，与createRolePropertyRecordFromMessage组合一致（role-creation-message-suite.log）。命令3内部属性失败时外层仍可登记，不把创建成功当作所有属性成功。上游5282e0/525520类别/收件人/命令分派另通过12组真实创建更新移除序列，与role-object-dispatch.ts组合一致（role-object-dispatch-suite.log）。原53d9c0完整字节包容器与53ee60网络接收入口另通过6组包拷贝/长度重写和84组类别/状态门禁对照，包含真实创建→阻止更新→生命更新→移除，与role-network-message.ts共享组合一致（role-network-inlet-suite.log）。数组544c70全量/增量编码与544950真实管理器接收另通过58/130组对照，全部342技能ID经当前16槽绑定进入生产状态/技能选择组合（role-array-property-suite.log）；接收不自动触发角色重算。全类型注册、完整服务初始化、TCP组帧/socket及FuncType2实际施放仍待恢复；共享网络模块尚未接入World，FUNC-02保持未勾选。

## 当前有限生产范围

物件9/skill9的Func7已接普通输入、CAS消费、权威10秒及生命周期、快照/Web敌对模型隐藏和CPU观察；物件10/11的Func8 X1/X2已接普通输入、CAS消费、临时技能与10秒状态、原4173/4174显示字段、快照/双方替身显示、合法开火恢复及CPU有限配置；物件502/skill502的Func18 X2/Y5000已接本队真实Castle恢复、普通消费、修复事件和CPU配置。原零价/GGet0不开放免费购买，字段事实与采用的规则分列client-communication-business-rules.md。三项实际对局、绘声及持久验收仍待执行；FUNC-08的Battle显式事件转发与延迟开火后重激活fire恢复待另一实现者集成，集中走查待root集成后执行。

Func13的物件3001定时炸弹沿old-bomb-policy.md的既有有限普通购买/放置/直接伤害、双端原资源和同库重启证据；不以该子范围替代原执行器、未知X30或全部函数完成。342技能/204道具的完整状态继续按tasklist.md追踪。
