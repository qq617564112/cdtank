# 首件可玩道具：宠物饲料

对应任务M1-09/M1-10/M1-11/M1-12/M1-13。这里只登记当前可玩的重建服务端行为；不宣称原FuncType2或原服务端成功条件已经恢复。

## 已确认来源与重建选择

原item.dat：物件1“宠物饲料”绑定技能1，BattleUseMax10；物件2“大包的宠物饲料”绑定技能2，BattleUseMax5。两技能TriggerType1、Target1、FuncType2、FuncT/X/Y/Z均0，HP分别200/400，原描述明确恢复对应生命。skill效果第一槽为Effect11、Sound GA15、Tag0、Method3。已发布combat-catalog.json。

客户端43d4dc与普通数字键请求、角色状态2、库存归属和数量门禁已有原执行证据，见item-use.md。原客户端只有请求、独立属性更新/效果/删除通知；当前尚未找到原服务端FuncType2分派、Target1的权威目标选择、满血是否消费及请求成功/扣量的绑定条件。因此以下选择明确属于重建规则：自用、满血拒绝、死者拒绝、恢复上限为当前玩法生命上限、成功扣1、存储提交后才修改战斗状态、零duration第一槽一次效果通知。表值/文字只能支持恢复量和内容，不能证明这些成功条件。

## 正式处理链

普通Digit5–8 → dispatchItemHotkey/requestItemUse → World.updateInput → applyHealingItem。仅物件1/2支持施放，其他物件仍只请求。World核对存活/状态、实例、原定义/技能、拥有与本局数量和缺失生命。恢复量读取源技能HP，生命不超过当前普通或VIP上限。成功先调用consumeItem，再同时更新World生命、拥有量和本局数量，发itemUsed及源技能PlaySkillEffect通知。满血返回itemRejected“满血无需使用道具”，无提交/无扣量；账户失配或存储错误返回itemRejected，不先恢复生命。旧输入sequence拒绝重复。

正式index.ts用当前连接会话解析playerId→accountId，AccountStore.consumeItem在BEGIN IMMEDIATE事务内核对该账户实例、物件定义与预期拥有数量，扣1并保留其他原字段；CAS失配、缺记录、他人实例或物件定义变化拒绝；相同实例/数量不能绕过定义核验。数据库提交失败不会写World。当前数据库保存拥有量，本局量随开局按照原BattleUseMax重新初始化，不保存临时房间。服务重启不恢复对局。

CPU只有明确绑定的库存才可能使用，不赠送道具。BotController读取当前生命、服务器上限、快捷槽和数量；缺失生命达到整份恢复量或当前生命低于35%时选择饲料。策略只发普通useItem槽号，移动/瞄准/开火仍沿原有CPU策略；World和真人共用权威入口。独立CPU管理UI尚未提供持久账户库存配置，该验收使用明确记录的fixture供给。正常网页另支持本人账户AI托管：玩家先配置自己拥有的库存，托管沿同一策略普通输入自主施放并真实持久消费；双网页两局、零库存、退出与重启×0及正常重新入房开局通过，见account-autopilot.md，不把托管本人账户称为独立CPU账户业务。

正式网页BattleSkillEffects收到itemUsed内的第一槽effectIndex0通知，经既有SkillEffectNotifications解析Effect11/GA15；HUD显示使用与拒绝提示。双网页正式施放已验证Effect11各创建5个实际绘制节点，tag0实际挂点存在，本机/旁观端均正常；两端GA15得到真实playing事件，源文件与非循环状态正确，自然ended后声音归零，效果自然结束后不再活跃，退出后全部特效实例/技能声音归零。截图healing-battle-1.png/2.png保留实际绿色恢复圈；原客户端逐像素/音频精度与全部组合仍未对照，这些精度任务归M4/M7；首件M1-12按其通知、原资源/挂点、声音、停止与清理验收，不以全部组合冒充首件范围。

## 验证与剩余

- `npm run test:combat:healing`：自然CPU开火造成真人伤害，正常键请求恢复/消耗/效果事件；满血、保存拒绝、旧序列、账户隔离、存储重启及其他DWORD/float位值保留。真人模拟验收包含两局自然终局/结果冻结，第一局拥有4→3、再战本局按剩余3初始化，旧局输入拒绝；第二局再次自然受伤后拥有/本局3→2，退出后房间清理，重新从账户建房开局本局仍为2，数据库重启保持2及其他原字段。未经修改的BotController在首局自然混战自主使用9次饲料、三实例全耗尽，第二局普通战斗仍有命中且自然终局，零库存不补回、不再施放；逐实例数量与事件对应。无生命/位置/伤害/结果注入。证据healing-item-world.json/log、cpu-healing-item.json/log、healing-item-lifecycle-suite.log。
- `npm run test:combat:healing:network`：隔离3137正式服务器、两个独立TSRPC账户、正常建房/加入/三CPU/准备/按键；两真人静止，CPU自然伤害触发使用，双方收到相同施放/效果通知，真实账户拥有3→2、本局3→2；重启恢复拥有量、原位值与快捷槽，另一账户空库存。证据healing-item-network.json/log。它不是双网页视觉验证。
- `npm run test:combat:healing:browser -- <CDP>`：隔离3138服务/5193网页、两个独立浏览器上下文；明确账户fixture导入，正常我的家选择饲料并配置第4槽，正常建房/加入/三CPU/真实鼠标准备。两局均由CPU自然造成伤害，真人每局只按一次Digit5；第一局双方同一正式itemUsed/效果通知、实际绘制与声音播放/自然结束通过。两局均自然达到混战目标并显示相同五人结算，分别54/52次同tick双端玩家状态一致，结算冻结通过。首局后房主正常点击再战，三CPU加房主共4票仍保持FINISHED，另一真人同意后才进入第二局，生命与击杀/死亡重置；正常Inventory查询确认第二局拥有/本局为2，再次使用后均为1。退出清理后重启服务器并刷新网页，原token恢复，正常库存页显示“宠物饲料 ×1”且实例77仍在槽4。监测仅包裹实际runtime调用及只读状态，无效果消息或战斗状态注入。画布426×240，窗口1280×720；此为流程/资源验收，不是高清性能或原像素精确验收。证据browser-healing-item.json、healing-item-browser.log、healing-battle-1.png/2.png。
- 普通请求及账户联网回归、五模式各两局CPU和类型检查：healing-item-input.log、healing-item-cpu-regression.log、healing-item-types.log。生产构建通过（healing-item-build.log）。

当前首件业务交付使用明确重建规则，原权威来源恢复继续保持M1-08/M1-09/M1-10未完成：缺失服务端3c9e处理器、FuncType2执行者、Target1权威含义、field10/field14用途，以及3c92与成功施放的原因果绑定。现存客户端实际3c9e发送不会进入其接收reader；不能继续在同一客户端请求入口反复推断服务端行为。下一步需要原服务端程序/协议记录或能建立该因果关系的新客户端调用入口；没有取得前不扩大取证。

本轮M1首件真实业务接线与验收：

- `m1-first-item-rules.log`：自然CPU造成伤害，满血明确拒绝、CAS/存储拒绝、旧序列不重复扣量，成功恢复生命与双方数量；真人两局/库存重入/重启、三CPU自主9次施放与第二局零库存通过。
- `m1-first-item-network.log`及`healing-item-network.json`：两个真实TSRPC账户收到相同满血拒绝和成功效果事件，施放后相同tick玩家状态一致、拥有/本局3→2、重复sequence不再施放或消费、账户隔离/服务重启保留数量与槽位通过。
- `m1-first-item-browser.log/json`：1920×1080两个正常网页，经库存页面配置槽4、建房/三CPU/准备，普通Digit5在两局自然受伤后各消费一次；两端原Effect11/GA15实际绘制/playing/ended/自然释放、两局结算相同、双人再战门槛、退出清理通过。两局39842/288988ms，相同tick玩家状态匹配11/126次。重启保留1份与实例77槽4，正常重新建房/加入/准备，普通按键再使用1→0，两端事件一致；第二次重启正常库存显示×0且槽4保留。没有注入位置、生命、伤害或终局；第二局按原300秒自然超时。
- `test:combat:healing:effect`与`healing-effect-fidelity.json`：源Effect11是三个精灵和两个粒子节点，没有CVD引用；原非保留树/五节点真实顶点/活tag_efcenter跟随、GA15单次分派、到期/显式停止/角色离场/runtime.stop网格材质清理通过。
- `m1-first-item-attachment-browser.log`与`browser-healing-item-hd-effect-only.json`：修正历史tag_body监测后，普通施放的两端实际Tag0映射及生产树parentMatrix身份、五绘制节点和声音/自然停止/退出清理专项。此专项不声称两局/保存。
- 本人账户AI双网页自然两局与零库存重启重入，证据`vip-movement-browser.log/json`；普通AI/CPU五模式两局与账户保存发行回归`m1-first-item-compiled.log`。全仓类型/229正式运行模块边界、独立两端构建通过`m1-first-item-{types,boundaries,build,web-build}.log`。

首件可玩的库存→普通输入→权威重建判定→作用/消费→双端表现→结算/重启恢复闭环按M1-09-B/M1-11-B/M1-12-B/M1-13-B单列验收；不据此勾选包含原消息语义/原因果与全部依赖的M1-13原版父项。独立CPU持久账户配置、全部技能和物件、原逐像素/混音精度/高清性能继续按M1-11/M4/M7记录，不混入首件重入流程缺口。
