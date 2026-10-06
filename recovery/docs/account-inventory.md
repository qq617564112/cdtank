# 重建账户、库存持久化与快捷槽权威接口

账户服务使用Node内置SQLite持久化账户、原库存记录及七槽配置。默认数据库为recovery/output/accounts.sqlite，ACCOUNT_DB_PATH可指定文件。账户首次打开返回随机accountId与token；持有token可重新连接同一账户。Web客户端保存在localStorage，并共享一次连接/账户登录Promise，地图查询与房间操作不会重复创建账户。原Windows登录流程、密码/频道和原服务端账户规则尚未恢复；这是重建服务端身份，不作为原认证协议复刻。

新账户库存为空。表中204种道具只提供定义，不赋予所有权。库存由运营者明确导入，保留instanceId、ItemTableID、拥有数量、本局数量、state、未知field8和三条float原位值；存储unsigned32值，不把float payload转成JavaScript float。删除库存实例时清除引用它的持久快捷槽。

## 接口

| TSRPC API | 输入 | 返回/规则 |
| --- | --- | --- |
| Account | 可选token | 无token创建空账户；有效token恢复身份；已在房间中不能切换账户 |
| Inventory | 空 | 房外返回账户持久records与七条hotkeys；房内返回当前角色副本的实时数量；未登录拒绝 |
| OwnedRoles | 空 | 返回当前登录账户的base/equipment原拥有记录，名称及[offset,value]字段数组无损传输；未登录拒绝，客户端不能指定其他账户 |
| Kitbag | ASSIGN/CANCEL、slot、可选instanceId | 核对当前账户所有权和已恢复原请求门槛，ASSIGN成功4并返回完整七槽，CANCEL成功1 |

slot1–7对应战斗数字键2–8。服务端按原库存分类及43dcc3请求条件验证配置，不把拥有数量0当作原请求拒绝条件。库存属于另一账户、错误槽型或非法槽号被拒绝。房间外可配置；加入后只允许WAITING阶段配置，进入PLAYING或FINISHED后拒绝。这是重建权威策略，不宣称已恢复原服务器的配置时机与错误状态枚举；失败使用TSRPC错误，成功字段保持原已证实值。

加入房间时把持久库存复制到角色，配置确认使用原applyKitbagAssignment/applyKitbagCancellation语义更新角色七槽。开局按原43d2e3对已配置实例初始化本局数量min(owned,BattleUseMax)，真人和CPU仍通过普通输入。World的数字键分派现查询角色库存，不再固定空数组。选择弹药本身不扣库存；普通数字键经原分派和许可发送陷阱/道具itemRequest，请求不扣量。实际射击的弹药属性、成功消耗及道具技能仍待实现。

## 库存导入

先通过Account接口建立账户，取得accountId。导入文件是InventoryWireRecord数组，字段均由来源数据明确提供；此工具不从catalog生成库存。

```bash
ACCOUNT_DB_PATH=recovery/output/accounts.sqlite npm run inventory:import -- <accountId> <records.json>
```

导入替换该账户库存；连接中的角色副本需退出房间后重新加入以刷新。运营导入工具不是对玩家公开的发放API。购入、奖励、初始赠送和完整成长待原客户端业务进一步恢复。

## 验证

`npm run test:accounts`使用临时数据库和明确测试库存，不污染正式数据库。测试验证新账户空库存、身份与库存隔离、原请求门槛、unsigned实例ID/float位值保存、七槽配置/取消、数据库重开及服务端停止重启后token与库存恢复、WAITING配置、PLAYING拒绝和正常网络数字键2选择弹药。拥有数量保持；未验证技能施放或消耗。

证据account-inventory.json、account-network.json及account-suite.log。既有网络回归单独验证兼容未调用Account的房间测试连接，Web正常入口调用Account，原客户端认证UI仍待还原。


## 两类拥有角色记录

AccountStore的role_records按account_id、kind与原实例键保存两类记录：base用原fields偏移0（41f23c索引键），equipment用偏移1c（4225b4索引键）。这两类记录独立于道具inventory和七快捷槽；名称与全部DWORD字段保存为JSON，读回ReadonlyMap，不将原位值解释成新属性。新账户两表为空，不从战车/宠物目录发放记录。

运营者导入必须明确给出两组记录；文件格式为对象base/equipment数组，每条包含name字符串和fields的[offset,value]数组，offset以十进制数字表示，value保留uint32。例中的名称和所有字段应来自实际归属资料，不能据定义表构造玩家所有权。导入整批替换该账户的两组记录，重复实例、无效字段或不存在账户拒绝，拒绝保留旧记录；两组间相同实例值允许，因为原索引独立。该入口不更改道具库存或快捷槽。

```bash
ACCOUNT_DB_PATH=recovery/output/accounts.sqlite npm run roles:import -- <accountId> <records.json>
```

roleRecords(accountId)返回两类原实例索引，可供已恢复的stage2来源getter查找；成对来源接收可保存索引中的已拥有对象引用。正式OwnedRoles查询由连接登录身份读取账户两类记录，房内/房外都只返回该账户的持久归属，不把当前房间临时战车选择视为装备。协议PtlOwnedRoles保留名称及[offset,value]数组，每个数字保持uint32原位值；空账户返回两组空数组。当前提供战车/宠物SelectRole选择API，完整装备装卸、默认选中配置及World开局装配仍未接入；这部分属于M6-01的后续业务，运营导入不代表原购买/初始发放恢复。

验证：npm run test:accounts、npx tsx recovery/evidence/attributes/role-recompute.cts、npx tsc --noEmit。16组原3aa5解析记录逐组保存并重开数据库，身份/账户隔离、两类实例查找、重复拒绝、独立清空、unsigned高位字段和中文名保存通过；独立进程执行实际roles:import命令通过。16组成对载荷经SQLite保存/读回→管理器来源接收→战斗来源getter→完整属性计算，与原433466结果/通知/dirty一致。后续夹具角色装配仍明确供给，不宣称正式账户对局接入。证据account-role-records.json、account-role-records-suite.log、account-role-records-recompute.log、account-role-records-types.log。


OwnedRoles联机验收：npm run test:accounts、npx tsc --noEmit通过。两独立TSRPC连接在正式服务端查询16组原成对载荷，字段数组与SQLite来源逐项相同；同实例键的不同账户返回各自内容/中文名称，未登录与重启后的未认证查询拒绝，重新登录恢复原内容，进房查询保持身份归属。测试服务使用独立端口3129及临时账户数据库，不修改常驻服务。证据account-network.json的ownedRoles、owned-roles-network-suite.log、owned-roles-network-types.log。此接口属于重建服务端合同，不宣称原线路消息格式，也不代替装备页面或World装配验收。


## 装备请求入口（M6-01）

原42762e使用当前本机角色的virtual+40取得拥有战车、virtual+3c取得战车定义，421cbe计算可用部件槽数。分类沿用439762（由记录+c的道具定义ID分类），类别8–12进入部件检查；其余类别直接发送。slot以原有符号比较必须小于计算槽数，上限拒绝产生诊断及本地消息735，不发送请求。

战车记录+58的三个定义ID先作同类别检查：只有owner+e8回调存在时，同类已装部件才通知类别并中止。之后检查角色array selector2中的可用槽；本实例已在其中时跳过后续实例冲突扫描，允许发送换槽请求。否则逐槽查拥有道具记录，同类别且不是类别12、且不是请求的目标槽，只有回调存在才通知并中止。类别12仍受三个定义ID的前置检查。没有回调时这些冲突分支继续发送；共享模块保留此原客户端行为，服务端装配权限和互斥尚未恢复。

实际请求由425c34构造，virtual type getter423e04返回3abb；427749写packet+c为记录+4的实例，427740写packet+10为请求槽位。完整原构造/析构执行证明packet+14保留调用栈值；425ca4 writer依次输出实例32位、槽32位、field14低8位。requestRoleEquipment仅表达已确认的两个赋值字段，不替未初始化的发送字段设默认值；同类型回包field14的装备错误语义见下节。该入口与资料变更3ab6不同；3ab7资料成功复制不能作为此请求装备成功的证明。此EquipItem入口不写装备；战车/宠物选中资料由独立SelectRole保存。

验证：npm run test:combat:equipment、npx tsc --noEmit。1080组涵盖战车/宠物/道具/五类部件、四槽/三种动态槽数、UI回调有无、定义ID冲突/本实例已装/同类实例已装/实例缺失，完整42762e、425c34构造/析构、439762分类和425ca4 writer均执行原代码；角色getter、421cbe计算结果、库存查找、网络/UI及bitstream存储为明确实验供给。所有源记录不变，共享模块发包/拒绝/通知逐项一致。证据role-equipment-request-native.json、role-equipment-request-suite.log、role-equipment-request-types.log。剩余验收按tasklist.md的M6-01执行。


## 动态部件槽与资料更新（M6-01）

完整421cbe先调用421ca9，统计拥有战车+58/+5c/+60三个非零定义ID，从拥有记录+6c容量减去该计数。若第一拥有来源存在，逐项读取其+44至+58六个技能ID和各自+18的等级，按baseId+rank−1查SkillTable，将实际记录+138的PartSlot逐项累加；没有第一拥有来源则返回容量减去固定部件数量。共享roleEquipmentSlotCount保持uint32回绕和全部六次查找，不跳过零ID/零等级，也不去重；装备请求入口将结果按原有符号比较使用。此计算不提供默认容量，也未证明战斗角色独立绑定装备来源的赋值链。

完整42662d接收3aac（UMsgPrUpdateClientData），message+1010为操作码，+1014为单独结果。code1先清除库存三个实际vector（+2c/+3c/+5c）的记录+1c状态，对应恢复库存group2/3/4；另外四组不变。除code3外，所有操作码都将message+c字节块经423f79解码到owner+40的资料wrapper+20，即使操作码超出通知分派范围也读取。code3完全跳过资料读取，直接通知单独结果。code0/1/2/4/5/7/8分别通知owner+a4/+a8/+b0/+ac/+bc/+c0/+b8回调值1；code3通知+b4的message+1014；code6和其他值没有UI回调。通知观察到的资料与库存已经更新。

资料解码完整调用42fd34→41fa67，并执行原numeric bitreader401d58、bool reader4139ad、string reader401fa6和byte reader401bd7。线路包含两个uint32长度前缀字符串、1位布尔、32个字节及全部数值和数组字段。Wrapper+4/+8在线路末尾读取；wrapper+c、+10、+14、+18、+1c、+168至+16f以及头部/字符串对象存储不由该reader替换。选中宠物/战车实例是嵌套资料+84/+88，落在wrapper+a4/+a8；共享解码结果已组合selector28/29读取验证。readRoleProfilePacket更新原有payload而不创建默认资料，applyRoleProfileUpdate保持先清状态、后读取、最后回调的顺序。

验证：npm run test:combat:equipment、npm run test:combat:profile、npx tsc --noEmit。384组动态槽计算覆盖固定部件数量、来源缺失、技能缺失、重复与回绕；96组完整资料线路覆盖全部8种位对齐、两字符串空/英文/中文原字节和unsigned值；264组完整3aac更新覆盖操作码0–9/ffffffff、回调有无及全部七库存组。取证供给SkillTable查找、字符串存储和UI回调，不替换421ca9/421cbe或资料解析/3aac处理函数。证据role-equipment-slot-count-native.json、role-equipment-slot-count-suite.log、role-profile-update-native.json、role-profile-update-suite.log、role-profile-update-types.log。

剩余链路：3abb请求和3aac资料更新各自已恢复，但其服务器产生关系、具体成功操作码及装备状态广播仍需确认；3abb回包4236ac本身仅查询实例、判断结果并通知类别，不能据此认定角色装备已更新。完整装备装卸API、正常页面确认和正式World属性接入按M6-01/M2-01/M2-02保持未验收。


## 原资料账户保存与查询

AccountStore的role_profiles按账户保存完整0x170字节RoleProfilePayload与两逻辑字符串。roleProfile返回独立副本；新账户没有资料，不从角色目录创建默认资料。replaceRoleProfile要求账户存在和原368字节/两字符串合同，保存资料不改变拥有记录、道具库存或快捷槽，也不因selected实例字段授予所有权。资料中的原虚表/存储数值仅保留为载荷字节，Web运行时不会执行这些地址。

运营者可明确导入已恢复资料：JSON包含bytes（368个0–255整数）与strings（两个字符串）；选择字段是嵌套资料+84/+88，位于payload+a4/+a8。数据来源必须是已恢复的账户资料，导入不代替玩家装备操作或原购买。命令验证字节值后保存，不截断非法数值；失败保留旧资料。

```bash
ACCOUNT_DB_PATH=recovery/output/accounts.sqlite npm run profile:import -- <accountId> <profile.json>
```

正式RoleProfile查询由连接登录身份读取本账户持久资料，没有客户端accountId选择；未登录拒绝，无资料返回空对象。拥有资料返回完整bytes与strings，房内/房外相同。该接口是重建TSRPC合同；不会把房间tankId变成原装备实例，也不自动修改当前World角色。原3aac解码共享模块可产生可保存资料，SelectRole已接入战车/宠物确认到保存，完整装备装卸及页面操作尚未接入。

验证：npm run test:accounts、npx tsc --noEmit。24份真实3aac code1夹具经过共享更新→SQLite保存→数据库重开，全部字节/字符串与原程序相同，selector28/29读回相同，查询副本修改不影响持久值；账户隔离、空资料、无赠品、中文字符串、实际CLI导入和非法导入不改旧资料通过。正式服务器双TSRPC连接传输24份完整载荷，另一账户空资料/不同中文字符串隔离，未登录及重启后认证门槛、重新登录恢复、进房查询均通过。证据account-role-profile.json、account-role-profile-suite.log、account-network.json的roleProfile、account-role-profile-network-suite.log、account-role-profile-types.log。M6-01整体仍需正常装卸、成功更新关系、界面与World属性验收。


## 战车选择请求与持久资料来源查找

原MyTank选择事件4e6305在控件事件解析/校验后执行4e63a0–4e63d1：取得本机角色virtual+40当前拥有战车记录，与页面+20所选记录比较对象引用。两引用相同不发请求；不同则将所选记录+1c实例ID传给完整4265e5。该函数实际执行425bde/425c11请求构造/析构，使用type getter424a5b（3ab4），packet+c只写选中实例；writer42571f输出唯一32位实例字段。没有本地资料写入、归属授予或属性重算。共享requestRoleTankSelection保留引用比较；同实例但不同对象仍发请求。原事件前半部widget解析尚未取证，此模块仅表示校验后的业务尾段。

AccountStore.selectedRoleSources将持久RoleProfile的payload+a4/+a8转换为嵌套资料+84/+88，通过已恢复selector28/29和stage2原来源getter合同，在本账户base/equipment实例索引分别查询。无资料返回两来源缺失；资料引用无拥有实例时该来源独立缺失，不改选中字段，不根据战车/宠物定义ID补来源。资料查询和拥有查询继续各自保存完整原字段，房间战车定义入口见本文件的持久战车选择章节；完整属性装配仍未接入。

验证：npm run test:combat:equipment、npm run test:accounts、npx tsc --noEmit。16组原UI校验后尾段、完整4265e5/type getter/writer对照通过，涵盖零/普通/高unsigned实例、同引用及同ID不同对象，记录和资料不变；原getter/transport/bitstream sink为明确边界。16组实际成对拥有载荷保存、明确供给selected实例后重开数据库，账户资料→原selector→原stage2查找合同取得对应原记录；另一账户即使保存同selected资料仍不能取得无归属记录，单独缺失base/equipment独立返回。该装配测试为显式fixture，不证明原服务器产生选择确认。证据role-tank-selection-native.json、role-tank-selection-suite.log、role-tank-selection-types.log、account-role-profile.json的selectedPairs、account-selected-role-sources-suite.log、account-selected-role-sources-types.log。


## 宠物选择与3aac线路包体

原MyPet事件4dc1c8–4dc214在widget事件校验后取得本机角色virtual+3c的当前拥有宠物，与页面+20的所选记录比较引用；相同不发送，不触发额外提示。不同引用时，若事件对象+8等于页面+f4控件，先调用4d650b的本地提示(type2,value1)，再将所选记录+0实例ID传给42659d。完整42659d执行425b73/425bbb构造/析构，type getter424a22为3ab3，writer42571f只输出32位实例。共享requestRolePetSelection保留提示先于请求、引用比较和不修改来源的行为。校验前widget处理和本地提示内容未在此测试恢复；不能把提示当成服务器成功确认。

3aac实际线路reader42da6a先调用完整42d6cd：读取32位资料字节数到message+100c，将字节块读入message+c的4096字节存储，再分别读取8位code/result到+1010/+1014（零扩展DWORD）。decodeRoleProfileUpdate支持该原存储容量内的完整载荷与任意位对齐，显式拒绝超过此固定存储的载荷；其输出直接进入applyRoleProfileUpdate。code3可以带空资料块，因为handler不解码资料；其他操作码需要可读的资料字段。此前直接handler fixture中的高DWORD结果用于验证内存调用合同，实际线路结果仅8位，不能据高位fixture推定协议宽度。

验证：npm run test:combat:equipment、npm run test:combat:profile、npm run test:accounts、npx tsc --noEmit。32组原宠物业务尾段、完整42659d/type/writer对照涵盖四实例值、同引用/同ID不同对象以及本地提示分支；384组完整42da6a/42d6cd/401d58原执行涵盖8位对齐、空/单字节/两种完整资料块、code0/1/3/255及result0/1/255，源包和未传递区域不变。240组共享线路解码→资料更新与已验证reader组合、回调时机一致；48组实际code1包体解码→更新→SQLite保存/数据库重开保持全载荷。证据role-pet-selection-native.json、role-pet-selection-suite.log、role-pet-selection-types.log、role-profile-update-wire-native.json、role-profile-update-wire-suite.log、account-role-profile.json的persistedEnvelopes、account-profile-envelope-suite.log、account-profile-envelope-types.log。选择请求成功到具体3aac操作码的原关系及完整玩家属性装配尚未验收。


## 战车/宠物选择确认接口

原MyTank页面注册片段4ed32e–4ed360以回调4ed1ae经491818写入角色管理器+a8；MyPet片段4de83f–4de86b以4de785经4917fa写入+a4。完整3aac处理器42662d在code1资料读取后调+a8(1)，在code0资料读取后调+a4(1)，因此code1绑定战车选择刷新、code0绑定宠物选择刷新。两页面实际回调参数低字节为0时返回true且不更新控件；非零时隐藏选择按钮、显示当前按钮并依次刷新三处内容。注册函数替换旧回调时释放旧对象；测试初始回调为空，执行真实保存函数及handler/page回调，不替换分派。回调构造/克隆、资料读取（独立完整取证）、控件存储及三处刷新内容为供给边界。

正式TSRPC SelectRole请求kind（pet/tank）与原instanceId，连接账户身份作为归属来源。AccountStore.selectRole要求原资料存在、uint32实例且存在于本账户base/equipment实例索引；仅改payload+a4（pet）或+a8（tank），保留其他全部字节、字符串和独立库存。成功先SQLite保存，再返回确认资料与原页面操作码0/1。无資料/无归属/错误实例拒绝，旧资料保留；PLAYING拒绝，房外/WAITING可配置，房内token不可切账户。该权限与阶段门槛是重建服务端规则；客户端证据证明选中字段/请求/回调对应关系，不能恢复已丢失服务器的所有资格、付费或成长门槛。等待房间与开局战车定义接入见下节；完整装备部件装卸API及World属性重算仍未实现。

验证：npm run test:combat:equipment、npm run test:accounts、npx tsc --noEmit。真实注册片段、两个完整页面回调以及3aac分派通过，包含0/1/255参数及先资料更新后刷新；16组成对拥有记录的宠物/战车选择保存精确只改各4字节，资料重开、无资料/无归属拒绝、无赠品与隔离通过。正式双连接为16组选择32次，返回code与完整资料逐字节一致，另一账户没有该归属时拒绝；服务器重启后资料与选择恢复，进房查询和PLAYING拒绝不改资料通过。证据role-selection-callback-native.json、role-selection-callback-suite.log、select-role-network-suite.log、select-role-types.log、account-network.json的roleProfile。玩家网页的拥有角色选择流程见下节，完整页面与World属性闭环仍按M6-01未完成。


## 我的家战车/宠物选择入口

正常网页“我的家：战车与宠物”打开HomeRoles，Battle通过正式OwnedRoles/RoleProfile读取本账户两组拥有实例和确认资料。战车列表使用myhome_panzerpage.xml的lstTank，宠物列表使用myhome_petpage.xml的lstPet；出击按钮分别使用btnUse/btnUseMe的原绝对坐标和mycabin00的chuji2图片。原父级矩形逐层相加；显示以800×600参考尺寸缩放，保留控件原长宽。字体加载沿用原字体资源。页面只列拥有实例名称，显示确认后的“当前”状态，不从目录赠送角色，也不显示未接属性为真实值。

点击拥有记录选择候选项，再点击原出击按钮或键盘Enter提交SelectRole；保存中禁用选择控件，收到服务器成功返回后更新完整资料并显示保存结果。拒绝保留确认资料并展示服务端错误，可再次操作；当前实例和空列表/缺资料禁用提交。切换战车/宠物只改变候选页面，不发送选择或更改资料；重新打开查询服务器。完整原模型预览、部件、宠物技能/成长及其他控件未在此入口实现，原页面UI-32/UI-34整体保持未验收。已保存战车选择应用于房间与开局定义；完整World权威属性尚未接入。

验证：npm run build、npm run test:roles:browser -- <CDP>。独立临时数据库、服务器3133、Vite5192与两个独立浏览器账户，从正常入口通过实际鼠标选择战车、键盘Enter选择宠物，服务器资料对应实例改变；空账户列表/禁用、1080p/4K控件比例/可见范围/原按钮资产加载、刷新及服务器重启恢复通过。显示额外拥有战车后删除其归属，再点击仍显示的候选项，服务器拒绝并保留旧选择，错误反馈通过。数据库角色及资料是显式原夹具导入；没有测试赠送/购买、完整装卸或高清战斗性能。证据browser-home-roles.json、home-roles-browser.log、home-roles-1920.png/3840.png、home-roles-build.log。


## 持久战车选择进入房间和开局

Join/CreateRoom/QuickMatch在创建或加入之前读取连接账户的profile+a8实例，通过本账户equipment索引及原421f88的record+24解析TankTable。存在资料时，保存的战车定义覆盖请求tankId；选中实例归属缺失或定义不存在则拒绝，不使用getTankConfig的首项回退，不改房间。没有账户资料的原型玩家仍按显式tankId进入，未建立默认拥有记录。该入口权限是重建服务端规则，原客户端证据只覆盖实例与定义的查找合同。

WAITING中的SelectRole(tank)先验证本账户实例对应的实际定义，再保存资料，应用World战车并取消玩家准备；房间快照显示确认战车，开始时保留该定义。宠物/战车选择同时刷新World的两类拥有来源，换宠物也取消此前准备；PLAYING拒绝更换。宠物世界模型仍未接入。World生命、伤害及800ms装填仍是原型数值；本节完成定义与拥有来源入口，不完成M2-01/M2-02或完整M6-01。

验证：npm run test:accounts、npx tsc --noEmit、npx tsx tests/cpu-match.cts 4。真实双连接验证请求tankId1被保存的定义2覆盖，建房、加入和快速匹配一致；WAITING切到定义105后取消准备，开局快照继续为105，未知定义选择拒绝且保留资料/战车，未知定义的三个入房入口拒绝且房间列表不变。角色布局来自原成对记录，定义2/105为显式测试装配，不代表原完整账户装配已恢复。CPU模式4两轮通过普通输入移动/开火/命中/死亡/复活、结算冻结、再战与房间清理，未注入位置或伤害。证据account-network.json的roleProfile.roomTankAuthority、role-room-accounts.log、role-room-types.log、role-room-cpu.log、cpu-match-mode4.json。


### 账户确认拥有来源进入World

正式Join/CreateRoom/QuickMatch在加入后调用bindAccountState：库存/七槽和selectedRoleSources一起进入房间角色。BattleRoleSources通过已恢复的receiveRoleOwnedPair保存独立拥有记录副本，原resolveOwnedRoleTank/Pet按record+24/+8查正式表；未知定义返回空，不使用目录首项回退。没有账户资料或归属的玩家/CPU保持来源为空，不自动获得角色。该账户到房间的权限和生命周期为重建规则，不代表恢复了原manager到role+a0/+a4的绑定指令。

World.bindRoleSources只允许WAITING；实际记录字段或名称变化取消玩家准备，相同持久记录重读保留准备。正式SelectRole确认后立即刷新两类来源；PLAYING/FINISHED禁止替换，再战保留已确认房间装配，离房销毁，新房重新读账户。直接更换World战车会清除旧战车拥有来源，防止残留不同定义；账户选择入口随后绑定确认记录。外部数据库修改不会改变运行中的房间来源，读出的快照也不能修改房间内部记录。

验证：npm run test:accounts:sources、npx tsx tests/account-network.cts、npm run test:cpu、npx tsc --noEmit。210组显式导入的21战车×10宠物来源覆盖全部16原成对消息夹具，验证账户隔离、独立副本、未知定义、数据库重开、World准备/冻结/再战/离房重建及CPU无赠品。双连接使用普通Ready/SelectRole(pet)请求确认换宠物取消准备、开局拒绝再换与持久资料保持。五模式CPU各两轮沿普通移动/开火输入回归通过；该回归未改变现有时限、生命或伤害规则。证据account-battle-role-sources.json、account-battle-role-sources-suite.log、account-battle-role-sources-network.log、account-battle-role-sources-cpu.log、account-battle-role-sources-types.log；网络用独立临时数据库/服务器。

这里只接入已确认的拥有记录/定义。当前16技能槽、独立boundGear、额外技能/道具角色字段、尺度与VIP来源尚未完整装配；不把选中宠物自动当作六组绑定技能，也不把profile装备实例直接当作重算所需道具表ID。尚未调用完整433466替换World属性，M2-01/M2-02继续未勾选。


### 确认装备资料与战斗部件定义

BattleRoleSources.replaceProfile读取已确认资料的装饰scalar44（payload+118）、array1三DWORD标记（+13c/+140/+144）及array2五DWORD部件（+148起）。它保存独立实例副本，不修改账户资料，标记后两值保持完整。资料实例ID与战斗部件表ID是两个入口：原43372d–43376b直接把OdlPlayer+bc至+cc的五值传给ItemTable的411068，而资料五槽保存拥有实例。不能把资料实例直接复制到RoleCombatState数组2。三标记及装饰如何转换到战斗字段仍未恢复，当前只保存来源，不写入未经确认的战斗数组1。

resolveBattlePartTableIds执行重建服务端归属门禁：从本账户库存按unsigned实例找到首记录，要求ownedQuantity>0、state2、分类8至12及原ItemTable定义存在；缺记录/空量/未装/其他分类/未知定义输出0，不以实例数值当表ID，也不回退到相近定义。World.bindBattleParts将解析出的五个表ID通过原setArray合同写入实际数组2并标dirty；battlePartSources使用当前16技能槽和原selectRoleItemSkills合同展开这五项的被动技能，保留重复来源且不自动添加主动技能或技能槽。原重算的三项固定部件、额外技能与两项其他道具来源仍独立待装配。

Join/CreateRoom/QuickMatch读取确认资料并绑定；SelectRole成功后刷新资料来源；Equipment成功装卸在同步库存标记后绑定返回的资料，并广播房间状态。WAITING资料装配变化或库存核验后的有效部件定义变化都会取消准备，查询/不变重读保留准备。PLAYING/FINISHED禁止资料替换；开局、死亡/复活状态转换和再战不清空确认资料/战斗部件定义，离房删除角色，重入从账户加载。CPU无导入资料时保持空。该账户资料→战斗定义的权限与转移是重建服务端规则；原客户端证据证明资料布局、ItemTableID消费与被动选择，不证明遗失原服务端的装配实现。

验证：npm run test:accounts:sources、npm run test:combat:skills、npx tsx tests/account-network.cts、npm run test:cpu、npx tsc --noEmit。32组完整原资料向量验证独立实例来源、高位unsigned与标记尾部；没有库存时不会生成有效战斗部件。204源物品逐条验证74件部件接受、130件其他分类拒绝；74组原程序两次物件来源的技能选择向量经两个不同拥有实例→World实际部件表ID→原被动选择逐值一致。数量/state0/1/255/缺失归属/未知表/错误分类拒绝、实例数值恰好等于另一个表ID、输入/输出修改不能污染状态、库存变化重绑定/准备、开局/再战冻结通过。完整343被动判断/1096原来源遍历本轮重新执行通过。双连接普通Ready/Equipment查询/装卸、PLAYING拒绝及五模式CPU各两局回归通过。

证据：account-battle-equipment-sources.json、account-battle-part-definitions.json、account-network.json的equipment准备字段；account-battle-part-definitions-suite.log、account-battle-part-definitions-sources.log、account-battle-part-definitions-native.log、account-battle-part-definitions-network.log、account-battle-part-definitions-cpu.log、account-battle-part-definitions-types.log。旧阶段把实例直接写入数组1/2的实现已纠正，本节只描述当前边界。

M2-01/M2-02/M4-03/M6-01继续未勾选。仍需完整角色属性对象、独立boundGear、其他技能/道具来源与装饰/标记转换的恢复及权威接入；部件来源已进入World原被动选择；当前完整拥有来源的非VIP角色已接完整433466并应用生命上限与普通装填，126组原结果/21战车开火/明确导入CPU实战见combat-field-inventory.md的“完整拥有来源的World权威重算”。实际伤害、移动、VIP、特殊弹药及全部账户技能装配仍未完成。


## 装备错误回包、部件五槽与重建装卸

3abb监听器绑定的4236ac为SYcPlayerSystem::OnEquipItemError。它先用message+c在真实43cd38库存向量查找实例；message+14等于0且owner+e8存在时，执行43bd13/439762分类并回调类别冲突；等于2报告原日志“Equip Slot Limit”，不调用冲突回调；1/3/255等其他值无后续动作。message+10在此函数未读取。该入口不修改资料、装备或库存。field14在回包是错误分支，而42762e发送端仍未初始化，不能据此给请求端赋一个默认成功值，也不能将收到3abb当成功装备。

资料虚表5c4118的getter+20指向42fe3f→4208b7，selector2返回payload+148的五个DWORD实例；setter+38指向42fe47→420916，selector2仅替换该20字节，保留其他字段和字符串。真实完整getter/setter16组及完整错误处理80组对照通过。卸载入口4284ae已恢复完整门禁与3abc发送合同，见下节。

正式Equipment QUERY/EQUIP/UNEQUIP使用连接账户，查询当前战车来源与资料五槽。容量来自已选拥有战车+6c减去+58/+5c/+60三个固定部件数量，加已选拥有宠物六组技能的PartSlot贡献，复用421cbe合同；实例必须属于本账户、拥有数量非零、存在实际ItemTable定义且分类8–12。EQUIP复用42762e槽数与互斥合同（提供冲突回调以拒绝）；同实例移动清旧槽，目标替换及类别12重复实例按原请求门禁允许。UNEQUIP清槽，允许卸下因容量降低而位于当前容量之外的旧部件。成功原子保存资料五槽和受影响库存state=2/0标记，其他资料、库存数量和快捷槽不变；失败不保存。房外/WAITING允许写，PLAYING拒绝写但仍可查询。房内同步库存确认标记。

上述移动/替换/卸下及标记保存是重建服务端规则；原证据证明请求门禁、装备标记读取和五槽存储，不证明原服务器资格/费用、成功返回操作码或完整全部分类装卸。部件8–12与装饰5/标记7已提供正式装卸，其他分类及宠物装备仍待恢复。World未应用该五槽完整属性，不将此接口视为原生命或装填复刻完成。

正常网页“我的家：战车部件”显示拥有部件与五个确认槽，选择部件后鼠标或Enter在目标槽装备，Delete卸下，错误保留确认状态；保存后焦点留在目标槽以继续键盘操作。该入口是功能面板，未复刻完整myhome_panzerpage布局；完整原战车页面按M5-07未验收。

验证：npm run test:combat:equipment、npm run test:accounts、npm run test:equipment:browser -- <CDP>、npm run build。账户测试涵盖归属/类别/容量/固定及动态互斥、10311“多带一个”容量贡献、同实例移动、目标替换标记、类别12重复、仅20字节变化、拒绝无写入、重启恢复和容量缩减后卸载。真实TSRPC验证WAITING装备、库存标记及PLAYING拒绝/查询；浏览器测试用实际鼠标装备/移动、Delete卸下，验证冲突/过期归属拒绝、两账户隔离、刷新/服务器重启及1080p/4K可操作边界。角色与物品为明确导入夹具，无赠品或购买假设。证据role-equipment-error-native.json、equipment-native-suite.log、equipment-error-suite.log、account-equipment.json、account-equipment-suite.log、account-network.json的equipment、equipment-accounts.log、equipment-types.log、browser-home-equipment.json、home-equipment-browser.log、home-equipment-1920.png/3840.png、home-equipment-build.log。


## 原卸装请求与当前服务端范围

共享requestRoleEquipmentUnload对照完整4284ae：空记录或inventory record+1c不等于2时不发送。分类5（皮肤）通过资料selector44查当前实例，getter42fdc5→42029e读取payload+118，再用43ccf2查拥有皮肤；分类7（标记）通过selector1的首槽payload+13c，再用43cd15查拥有标记。两类都要求查到的实例与候选实例相同。分类8–12（部件）扫描selector2的五槽数组，扫描数量为5减去当前拥有战车+58/+5c/+60中非零固定部件数量；逐槽43cd38查拥有部件，匹配实例才发送。该数量独立于421cbe动态容量及宠物技能贡献。其他分类在state=2时直接发送，此入口没有额外当前槽检查；这不证明它们已具备正确的服务端装卸业务。

实际3abc构造425d0f、析构425d42、类型getter424ac7及writer521a15经原程序执行：发送端只写message+c实例；message+10保持调用栈供给值，writer仍把两字段分别写为32位。第二字段含义及原服务器处理尚无依据，共享合同仅提交已证明的实例，不为第二字段补默认值，也不据此更新资料。库存、资料及拥有战车在原入口执行后保持不变。

正式Equipment UNEQUIP继续采用重建服务端规则：按账户已确认五槽及归属卸下部件，允许清理容量缩减后的旧槽。原客户端固定部件扫描门禁记录在共享合同中，未强加到此接口；其限制可能遮住已保存的后部槽。正式接口支持部件8–12及下节的装饰5/标记7；World属性与模型应用仍待完成。M6-01保持未勾选。

验证：npm run test:combat:equipment、npx tsc --noEmit。1408组完整原卸装执行覆盖11种定义ID、state0/1/2/255、0–3固定部件、五个匹配槽、不同实例、归属缺失与失效槽引用；共享合同逐项对照发送与拒绝结果，验证空记录及全部源记录不变。原资料虚拟getter、库存向量查找、分类、构造/析构和writer实际执行；选中战车getter、transport和bitstream存储为明确供给边界。证据role-equipment-unload-native.json、equipment-unload-suite.log、equipment-unload-types.log。


## 装饰与标记的正式装卸

物品分类5在源ItemTable中包含顶灯、帽子、翅膀等装饰，分类7是标志；网页分别显示“装饰”和“标记”。原scalar selector44经42fdc5→42029e读payload+118，setter42fdea→420551仅改该DWORD。array selector1经42fe3f→4208b7返回payload+13c三DWORD；setter42fe47→420916复制全部三个DWORD。当前标记操作仅替换首实例，并供给未改的后两DWORD，保持原资料其他字节及字符串。32组原完整虚拟getter/setter执行与共享读写结果逐字节一致。

Equipment增加target=PART/DECORATION/MARK；未指定仍按部件槽操作。QUERY统一返回五部件槽、动态容量、装饰实例、首标记实例及完整确认资料。装饰/标记EQUIP要求本账户数量非零的实际ItemTable定义，分类分别5/7；替换仅改目标资料DWORD，原子保存旧实例state0及当前实例state2。UNEQUIP复用原4284ae的state2及当前实例查找门禁，清对应字段；错误不保存。资料和库存确认仍由服务端产生，房外/WAITING可写，PLAYING仅查询。以上资格与替换提交为重建服务端规则，尚无原成功回包及费用的完整恢复依据。

正常“我的家：战车部件”面板增加拥有装饰与标记、两个对应槽；鼠标或Enter装上，Delete卸下，替换更新库存标记，错误保留原确认与焦点。选中错误类别提交到另一槽时服务端拒绝。此功能面板没有完成原页面布局、装饰模型/绑定位置、World模型/属性或全部装备分类，M5-07/M6-01/M6-03保持未勾选。

验证：npm run test:combat:equipment、npm run test:accounts、npm run test:equipment:browser -- <CDP>、npm run build。账户测试覆盖正确分类、错误槽类别、缺失归属、零数量、空槽、替换/卸下、两个字段共8字节及标记后两DWORD保留、库存标记、重开恢复和账户隔离；真实TSRPC连接覆盖两类装卸、另一账户拒绝与PLAYING拒绝。浏览器用实际鼠标装备/替换、键盘Delete卸下，刷新/服务器重启保留两类实例，1080p/4K边界与原部件流程一起验证。证据role-profile-cosmetics-native.json、account-equipment.json的cosmetics、account-network.json的equipment、browser-home-equipment.json的cosmetics、cosmetic-native-suite.log、cosmetic-accounts.log、cosmetic-account-store.log、cosmetic-network.log、cosmetic-types.log、cosmetic-browser.log、cosmetic-build.log。


## 原战车页装备区域

HomeEquipment读取ui.json中的myhome_panzerpage.xml，按父链累计AbsoluteRect（含SheetWindow的36像素顶部偏移），显示原rdoCommon/rdoHat/rdoMark、lstEquip、picHatIcon/picMarkIcon、picInternalPart0/1和picExternalPart0/1/2。采用原背景heseditu/ditukuang/heseditu2、七个bg槽图及daoju0物品图标；分栏使用NormalImage/PushedImage对应确认的当前分类。仅按账户归属列出一般部件8–12、装饰5和标记7，确认槽使用Equipment回包实例；选择候选后点击相应槽或Enter装备，Delete卸下，拒绝保留旧确认及目标槽焦点。源五个部件图标控件用于重建五槽操作，其与原固定部件/外部槽显示的完整运行时关系尚未恢复，不能据控件名称推定原全部槽业务。

当前映射21个源控件；候选物品说明取实际ItemTable.name/info，在预览区域单独显示。原战车模型预览、属性/货币数值、改装按钮和费用未完成，完整93控件及修改子页仍待验收，M5-07/UI-32均未勾选。

验证：npm run test:equipment:browser -- <CDP>、npx tsc --noEmit、npm run build。实际浏览器核对21控件映射，直接与源XML导出的父链坐标/尺寸比较，在1080p/4K容差1像素；所有实际背景/图标资源经Image.decode成功，标记图标匹配源daoju0映射。鼠标分栏切换、部件/装饰/标记装卸/替换、物理Delete、拒绝保留、刷新/服务器重启与账户隔离通过。证据browser-home-equipment.json的sourceControls/sourceCoordinates1080p4K/sourceAssetsDecoded及cosmetics、equipment-source-ui-browser.log、equipment-source-ui-types.log、equipment-source-ui-build.log、home-equipment-1920.png/3840.png。


## 拥有战车的模型预览

HomeRoles的战车页在原picModel（218×218）区域显示拥有实例对应的原战车组件，名称放到txtTankName。默认使用资料+a8的确认实例；选择列表候选时预览该实例，保存成功后保持确认模型；服务器拒绝时恢复当前确认实例及模型。定义ID来自原421f88证明的拥有战车record+24，不把实例ID当定义，也不回退到目录首项。使用HomeSourceLayout累积父链源坐标，补原heseditu/ditukuang背景，移除按钮额外margin。宠物页目前仍没有宠物模型。

HomeTankPreview使用独立Babylon场景，复用TankView的原组件/待机01动作。TankView.loadPreview只载入待机，战斗load继续额外预载死亡09，以免延迟跨越复活周期。候选切换丢弃旧加载结果；关闭/切到宠物释放模型、场景和Engine。高清画布按照实际CSS缩放后的像素尺寸设置，窗口变化后下一帧更新，不仅拉伸低分辨率画布。渲染完成一帧才登记renderedTankId，浏览器验收等待该字段匹配当前候选。相机角度、光照和基于网格边界的构图为Web实现，尚未对照原预览镜头；装备附件/标志模型及原页面完整属性仍未接入。

验证：npm run test:roles:browser -- <CDP>、npx tsc --noEmit、npm run build；死亡/复活回归使用node tests/browser-life.mjs <CDP> <本轮独立预览地址>。显式导入的原拥有布局供给有效战车定义，实际鼠标/键盘选择、确认保存、过期归属拒绝恢复、刷新/服务器重启、关闭释放与账户隔离检查。模型区域和画布像素尺寸在1080p/4K对照，正常拥有列表逐项选择21源战车，要求可见网格非零及实际完成一帧渲染。死亡/复活测试为独立快照夹具，不证明一次新CPU对局。证据browser-home-roles.json的preview、home-tank-preview-browser.log、home-tank-preview-types.log、home-tank-preview-build.log、home-tank-preview-life.log、browser-life.json、home-tank-preview-1920.png/3840.png。


## 装备操作中的确认战车预览

HomeEquipment同时查询本账户OwnedRoles和Equipment确认资料，用profile+a8查拥有战车实例，再以record+24加载原待机组件。原picModel与txtTankName和装饰/标记/部件槽显示在同一装备页；候选装备不会改变预览战车，成功/拒绝后的确认资料继续决定战车实例。关闭释放预览Engine与模型，刷新/服务端重启重新查询选中实例。物品说明显示在模型右侧，预览不装配尚未恢复的装饰附件或标志模型。

验证：npm run test:equipment:browser -- <CDP>、npx tsc --noEmit、npm run build。原装备区域23控件坐标逐项对照，模型显示账户实例72/定义2，完成实际渲染且网格非零；1080p/4K模型区域及画布像素尺寸一致。普通鼠标/键盘装卸、替换、拒绝保留及刷新/重启测试沿用原装备流程，关闭后状态empty。证据browser-home-equipment.json的savedTankPreview/previewCloseDisposes及sizes.model、equipment-preview-browser.log、equipment-preview-types.log、equipment-preview-build.log、home-equipment-1920.png/3840.png。


## 原预览自动转动

MyTank页面更新4e5e22–4e5e3a在预览存在时实际调用472e01(0,float32(0.0075))；页面deltaTime另在后续472cd9传入，角度增量不乘它。472e01取引擎当前相机，转到camera+d4调用4572aa，然后更新其virtual+4；夹具执行该入口直到实际4572aa调用，virtual+4尾段只依据指令读取，未在此夹具执行。4572aa前段分别将第一增量加到+8，第二增量加到+10与+c，三值各自写回float32；原4570c5后段将+c用于绕Y旋转视线向量。共享advanceHomePreviewOrbit保留这三个字段的写回精度。64组原页面调用/相机分派及实际累加与共享结果一致；夹具边界为引擎相机getter，以及尚未执行的矩阵/LookAt尾段。

HomeTankPreview每次渲染更新调用共享累加，按orbitYaw变化量推进Babylon alpha，以适配转换模型的X反射；待机模型持续播放。该频率对应Web渲染更新，原固定增量与每次调用精度已验证，原程序页面调度频率尚未恢复。初始相机角度、基于边界的距离、投影和光照仍为Web实现；本节只完成自动转动，不完成整套原镜头。

验证：npm run test:home:orbit、node tests/browser-home-preview-orbit.mjs <CDP>、npx tsc --noEmit、npm run build。独立浏览器模型夹具显示真实定义2待机组件，等待至少12次渲染后逐次float32计算，确认累加状态及相机alpha差值一致；关闭后渲染帧数冻结。该检查不使用旧运行服务器协议，也不替代已有21战车/账户装卸检查。证据home-preview-orbit-native.json、home-preview-orbit-suite.log、browser-home-preview-orbit.json、home-preview-orbit-browser.log、home-preview-orbit-types.log、home-preview-orbit-build.log。


## 原预览相机模式与裁剪距离

预览构造472c12经44727c选择相机模式2；后者进入455f46，按相机记录+90模式查找。切换到模式2时，若先前相机存在，将其+18/+24/+3c三组3float向量和+98 DWORD复制到目标，然后调用455ef1重新装配投影。故初始视角依赖原共享相机状态，不是从预览构造单独取得的固定角度。

完整455ef1调用gbCamera::SetDimention（import5c093c）传入宽/高，明确写projection+10=10、+14=5000，然后调用当前模式2虚拟+8，即455a42，把投影对象绑定到camera+94。455a42根据camera+98/+9c写投影的两个首字段；这些字段的完整投影类型/单位仍未恢复，未用于猜测视场。HomeTankPreview采用已证明的minZ10/maxZ5000，其他初始相机与边界构图保持Web实现。

验证：npm run test:home:orbit、node tests/browser-home-preview-orbit.mjs <CDP>、npx tsc --noEmit、npm run build。16组完整原模式切换/投影装配与实际模式2虚拟绑定涵盖218/392/785方形及800×600尺寸、四组+98/+9c值；原三向量/+98继承保持不变，近远裁剪固定10/5000。gbCamera::SetDimention为供给边界，相机观察者向量为空，矩阵与初始共享相机来源未执行。真实浏览器显示定义2组件并完成渲染，实际相机裁剪值与源值一致，自动转动与关闭停止仍通过。证据home-preview-projection-native.json、home-preview-projection-suite.log、browser-home-preview-orbit.json的clipPlanes、home-preview-projection-browser.log、home-preview-projection-types.log、home-preview-projection-build.log、home-preview-projection.png（裁剪后的实际画布，模型可见）。
