# CDTank 复刻工程

使用原Windows客户端恢复资源与行为依据，开发 Babylon.js Web客户端和 Node/TSRPC 服务端。完整范围、阶段证据和未完成项见 [progress.md](progress.md)。Web客户端提供原版模型查看与五模式联机对局、权威结算和全员同意再战。玩法闭环采用明确记录的重建规则，原版规则/数值与全部界面业务仍在还原。

## 运行资源查看器

需Python 3、Node.js 22和本地 `CDTank/` 原资源。

```bash
python3 -m venv recovery/.venv
recovery/.venv/bin/python -m pip install -r recovery/requirements.txt
npm ci
recovery/.venv/bin/python recovery/inspect_assets.py --out recovery/output/verified
npm run assets
npm run assets:catalog
npm run dev
```

访问 `http://localhost:5173`。已存在verified目录时复用解包结果；提取器要求新的目标目录，防止覆盖原结果。缺少ensurepip的环境可用 `python3 -m venv --without-pip recovery/.venv`，再通过 `python3 -m pip --python recovery/.venv/bin/python install -r recovery/requirements.txt` 安装。

地图下拉框可组合原地形与已匹配的静态物件和原版城堡（25张地图，动态状态与原导航/动态碰撞待还原）。

查看器提供745个MV3、138个POL（含25张基础地图）及81个CVD局部动画资源选择、相机旋转、动作播放及全屏。原始文件不修改；解包和Web资产均位于 `recovery/output/`。已转换PNG时可用 `recovery/.venv/bin/python recovery/convert_mv3.py --models-only` 仅重建GLB。

## 验证

```bash
npm run test:assets
npm run test:network
npm run test:match
npm run test:rooms
npm run test:battlefield
npm run test:navigation
npm run test:tanks
npm run test:audio
npm run build
```

资产校验检查全部GLB结构，以及代表战车/宠物的源三角形、UV和morph帧，并逐三角形检查全部138个POL的位置、UV、法线/顶点色及81个CVD的全部局部帧与秒时间。结构有效不代表光照、动作时序和原版行为已完全还原。

## 服务端

账户在线备份与新路径恢复命令、运行配置和存档范围见 [运行与账户存档](deployment/operations.md)。

生产 Web 构建使用 `npm run build`（等同于 `npm run build:web`），执行客户端类型检查并输出到 `dist/web`。正式入口为 `index.html`，诊断入口为 `validation.html`。服务端独立运行 `npm run build:server`，再用 `npm --prefix apps/server start` 启动编译产物；账户保存路径用 `ACCOUNT_DB_PATH` 指定，资源路径用 `WEB_ASSETS` 和 `CONTENT_TABLES` 指定，配置示例见 `deployment/server.env.example`。

正式入口先显示登录页：已有保存身份可直接登录；填写账号和密码后可注册，将当前保存账户绑定具名凭据。认证后在频道页双击“当前服务器”进入大厅。保存账号只记住账号名称，密码不保存到浏览器。频道页可返回登录或退出；登录页可打开系统设置和游戏介绍。认证与单部署频道规则见 [登录与频道选择](recovery/docs/login-channel-policy.md)。


完成原始数据表导出后运行 `npm run dev:server`，默认 `ws://localhost:3001`。`npm run test:network` 会自动启动3109测试服务器并验证三个独立连接。范围和原型参数见 [联机基础说明](recovery/docs/server-foundation.md)。同时运行 `npm run dev`，在两个浏览器窗口中分别登录并确认频道，选择同一房间并加入。W/S移动，A/D转向，方向键控制炮塔，空格开火；服务器计算位置与弹丸。Vite通过 `/game` 代理WebSocket到3001端口。联机已载入对应原地图，服务器使用恢复地形与虚拟盒体判定移动及弹丸碰撞；原模式和数值规则继续还原。

使用已启动Chromium的CDP WebSocket地址可运行 `node tests/browser-battle.mjs <CDP地址>`，自动创建两个浏览器窗口验证房间、原地图/城堡/原战车加载、源坐标映射、远端移动/弹丸及退出清理。证据输出到 `recovery/output/browser-battle.json` 和 `.png`。

`npm run test:combat:browser -- <CDP地址>`通过两个真实浏览器的键盘输入验证原地图命中、击毁、双方死亡动作09、计分归属及满血重生01，输出 `browser-combat.json` 和死亡/重生截图。`npm run test:life:browser -- <CDP地址>`验证复活立即落位及角色、动作、地图加载期间退出的资源清理。原模式结算和完整伤害公式仍待还原。

使用 `npm run test:scenes:browser -- <CDP地址>` 验证三张地图的原始放置坐标、旋转与浏览器世界顶点，以及地图相机方向。输出见 `recovery/output/scene-browser-verification.json` 和 `scene-0002.png`。

## 工程结构

- `apps/web`：Babylon.js资源查看器、房间操作及联机战车显示；原版界面和完整战斗待还原。
- `apps/server`、`apps/shared`：开发中的TSRPC协议和权威模拟基础。
- `recovery`：CPK和数据表提取、MV3解析和转换、资源清单。
- `recovery/docs`：网络、格式与界面来源证据。
- `tests`：资产验证及后续联机验证。

当前素材是本地原客户端内容。生成的素材、Windows客户端和依赖不纳入Git。

战斗入口可选择原表中的21种战车，并组合原M/U/X/Y部件与独立炮塔瞄准；基础动画播放已接入，完整动作和技能仍在还原。全战车浏览器几何及动画验证：`npm run test:tanks:browser -- <CDP地址>`。依据见 `recovery/docs/tank-runtime.md`。

原界面资源通过 `npm run assets:ui` 导出：65布局、4,347图块和12份字体定义。战斗已显示原生命槽、数字字体计时器和消息背景。`npm run test:ui`核对源图块，`npm run test:hud:browser -- <CDP地址>`验证高清布局与状态显示；覆盖边界见 `recovery/docs/ui-runtime.md`。

原音频通过 `npm run assets:audio` 发布14首MP3、174份WAV、174条声音ID与26条地图音乐映射，并导出原PE音效证据，已包含在 `npm run assets` 中。战斗播放对应原地图音乐；权威普通开火以原技能2001播放GA07和攻击头像，客户端支持原21条技能声音映射；击毁声音按原战车类别、队伍和100/1600/2线性距离参数播放在击毁者位置。音乐/音效滑杆独立调节或静音，退出及断线停止。`npm run test:audio`验证源字节与映射，`npm run test:audio:browser -- <CDP地址>`验证全量解码、实际输出、距离衰减和清理。其他WAV事件及大厅/结算音乐仍待恢复，依据见 `recovery/docs/audio-runtime.md`。

`npm run assets:effects`恢复20份ELK挂接配置及effect.sav的3,118个效果节点；`npm run test:effects`验证源字节完整重建和挂接引用。粒子运行与参数语义仍在恢复，详情见`recovery/docs/effect-runtime.md`。

当前对局用法：玩家选择同一等待房间加入，地图和战车载入后主动点击“准备”（可取消）。达到原表最低人数且所有人准备后开战；通常需四人，部分地图为一人或两人。团队耗尽出击次数、占领圈独占计时、擒王击毁敌王、混战击毁竞争、射击破坏原场景物件；屏幕目标提示与地图标记显示状态。结算后所有在房玩家点击“再来一局”即可继续，或点击“返回”。规则来源与原版差异见 [可玩对局说明](recovery/docs/playable-match.md)。

`npm run test:match`验证五模式重建规则及完整状态转换；`npm run test:match:browser -- <CDP地址>`以四个真实浏览器验证擒王键盘战斗、结算、一致再战与第二局移动/退出。结果在`recovery/output/browser-match.json`。默认时限来自原表，短局运行可在启动服务端时设正数`MATCH_TIME_LIMIT_SECONDS`；该值只受服务端配置控制。

点击“创建房间”可选择原表中的全部26个模式/地图组合，填写房名并创建进入。另一浏览器通过房间列表加入同一房间即可对战；退出后空的自建房回收。`npm run test:rooms`逐组合验证源地图/时限/人数/出生及建房校验，`npm run test:rooms:browser -- <CDP地址>`验证真实双浏览器选图建房、0004早安一路载图和联机移动。房间密码、等待换队与准备已可操作；原窗口外观、等级、种族/友伤及邀请业务仍待恢复。

双浏览器旧基础/团队combat测试需要测试服务器设置`MATCH_MIN_PLAYERS=2`；正常服务器默认遵守原PlayerMin。四浏览器rooms/match测试遵守默认四人门槛。该覆盖只用于技术回归，不能当作原人数规则证据。

等待房间可点击“加入猫队／加入狗队”，名单显示每人队伍和准备状态。换队后全员重新准备，团队类模式要求双方都有成员；混战/破坏不显示换队选项。

`npm run test:capture:browser -- <CDP地址>`通过四个真实浏览器、正常键盘操作验证占领进圈、权威计时胜利、双方结算、全员再战与目标计数重置，证据输出browser-capture.json和占领/结算截图。当前占领规则与目标仍属明确记录的重建实现，原目标规则持续恢复。

创建房间可填密码（留空公开），房间列表标出“密码房”。加入锁定房间前填房间密码；错误密码会显示原因，成功后清空输入。当前房间密码规则为重建业务，原窗口精确外观和其他设置仍待恢复。

`npm run test:destroy:browser -- <CDP地址>`验证四客户端自然开火摧毁一个原场景物件、同步淡出/隐藏、退出后重入、全员再战恢复满血与原模型。

`npm run test:timed:browser -- <CDP地址> <模式>`验证真实原时限对局：模式1/4在原0007木桶广场使用两名玩家和300秒时限，模式5在0020使用四名玩家和180秒时限。脚本以键盘造成一次击毁或物件摧毁，再等待实际截止，检查同一结算、胜者、结算冻结、全员再战及退出，输出browser-timed-mode1/4/5.json与截图。服务端需按默认原时限和人数启动，不设置MATCH_TIME_LIMIT_SECONDS/MATCH_MIN_PLAYERS覆盖。该验证覆盖时间结束分支；团队次数耗尽、混战10次击毁及破坏全物件清空仍是独立验收范围。

`npm run test:melee:browser -- <CDP地址>`以两个真实浏览器在原0007地图通过键盘移动到射击位置、连续瞄准随机原出生位置，完成十次自然击毁与九次满血重生，验证目标达成胜利、相同结算、冻结结果、全票再战和退出。证据输出browser-melee-objective.json/.png，使用正常原时限和人数配置。

首页“一键 CPU 对局”自动创建木桶广场混战、加入三名CPU，等待地图和战车载入后准备；失败可重试。`npm run test:cpu:entry -- <CDP地址>`验证资源失败、重试、自动准备及CPU自主移动。房主也可在等待界面点击“添加 CPU”，再点击准备即可旁观自主对局；CPU自动准备，真人发起再战时CPU自动同意。CPU使用与真人相同的服务端输入和战斗规则。`npm run test:cpu`检查五模式自动对局及生命周期，`npm run test:cpu:maps`覆盖全部26模式／地图组合；这两项使用推进的测试时钟。`npm run test:cpu:browser -- <CDP地址>`运行真实时间的自主对局，`npm run test:cpu:hd -- <CDP地址>`检查两个1920×1080客户端的结果同步及再战。目标胜利与时间截止分别记录，范围见[CPU说明](recovery/docs/cpu-runtime.md)和[全地图验收](recovery/docs/cpu-map-acceptance.md)。

CPU现在会绕开队友挡住的射击线，并在路径失败后尝试其他射击站位或目标。`npm run test:cpu:maps -- 0 1 4 17`只复验混战0017；参数依次是分片、分片总数、可选模式、可选地图，筛选结果写入独立的mode／map汇总文件。

破坏CPU连续开火5秒而目标血量没有变化时，会尝试另一射击站位；持续命中则保持站位。`npm run test:cpu:realtime -- 20 30000 5`用真实计时与两条网络连接观察0020破坏模式30秒；第三参数是模式，省略时为团队模式1。脚本检查普通CPU输入自然命中物件、双方快照一致和断线清理。

`npm run test:cpu:realtime -- 21 0 5`运行原0021破坏模式的完整实时比赛，再检查双方结算一致、结果冻结、CPU等待两位真人同意再战、第二局重置及退出清理。第二参数0表示等待自然终局。`npx tsx tests/cpu-destroy-diagnostics.cts 21`记录自动对局中的目标、路径、位置与物件射线，便于定位卡点；CPU遇到连续前进无位移时会通过原碰撞允许的局部路径脱困。

`npm run test:cpu:objectives`依次严格验收0020六CPU、0021三CPU、0022三CPU的完整实时目标胜利。每场两条真人连接仅旁观，CPU走普通输入；时间截止或残余破坏目标使命令失败，仍先记录证据并检查再战、断线清理。单图可用`npm run test:cpu:realtime -- 22 0 5 3 --require-objective`。完整对局每30秒输出剩余时间和目标完成数；入口、通过条件及后续实施顺序见[CPU自动验收](recovery/docs/cpu-acceptance.md)。

`npm run test:cpu:realtime -- 22 0 5`自动跑0022完整破坏对局。CPU没有可走路径且寻路8秒未完成时会暂缓目标，随后尝试其他站位，避免整局停在同一搜索上；原人数、时限、目标HP及碰撞保持不变。

实时脚本第四参数可指定CPU人数，默认3。例如`npm run test:cpu:realtime -- 20 0 5 6`验证原0020容量内六CPU和两个旁观客户端的完整对局，仍检查全部CPU再战票、双方状态/事件一致、重开及断线清理；结果写入`cpu-realtime-20-full-cpu6.json`。CPU优先选择同队CPU尚未负责的破坏物件，保留独自承担的目标，所有目标都有人处理时允许协助。 CPU沿有效路线接近固定破坏目标时保留路线；目标变化、移动卡住和射击无效仍触发调整。 新任务优先选择炮口射线能直接命中原盒体的目标，在可射中的目标间优先分工，避免仅按直线距离寻找隔墙目标。 等待完整路径时，CPU可通过普通输入沿服务端碰撞查询接受的路段推进。 静态盒体候选索引保留原求交结果，分帧寻路每次最多256步/2ms软预算；0020六CPU已有原时限内117/117完整实时目标胜利记录。`npx tsx tests/cpu-destroy-diagnostics.cts 20 6`记录六CPU的目标、路线、暂缓状态和炮口求交，输出独立`-cpu6`证据。

`npm run test:cpu:realtime -- 4 0 1`自动验证完整团队比赛：两条真实连接旁观三名CPU，按地图原时限运行，逐值比较双方快照和首局有序战斗事件，并记录每名CPU的队伍、开火、命中、击毁和死亡。双方真人不发送战斗输入；CPU同时承担队友和对手。完整比赛还检查结算冻结、真人同意后的再战重置和断线清理。证据写入`recovery/output/cpu-realtime-4-full.json`。

`npm run test:cpu:queries -- 4 600 current`测量复杂0004地图前600个步进的服务端CPU输入、寻路和碰撞查询成本，输出`cpu-query-profile-4-current.json`。这是带采样开销的模拟，方法耗时有嵌套；在线节拍独立检查。地形查询优化已通过全部25图1213射线与原算术穷举结果逐值对照，纳入`npm run test:battlefield`。

`npm run test:cpu:realtime -- 4 30000`启动独立3117服务器，以原人数／时限和实际20Hz计时观察3CPU战斗30秒，检查两条连接收到同tick完整快照一致、自然命中和断线清理，记录实际节拍；不涉及浏览器渲染或完整比赛。`npm run evidence:combat`导出原客户端技能选择、两个角色装填时长getter及相对时间戳调用链；证据范围见[战斗字段说明](recovery/docs/combat-field-inventory.md)。

数字键1–8通过普通输入发送一次快捷槽请求，CPU开局也通过同一入口选择默认弹药。持久账户库存和七槽已接入World，空库存槽不产生动作；弹药选择及许可通过的陷阱/普通道具请求通过真实输入同步，施放与成功扣量仍待实现。`npm run test:combat:item-input`验证开局数量、请求许可、旧输入和房内实时数量。`npm run test:combat:items`核对4936次原快捷槽分派与56次数量初始化；`npm run test:combat:items:browser -- <CDP地址>`验证数字键、聊天焦点、重复按键、CPU自动交战及退出。依据见[库存快捷槽](recovery/docs/item-hotkeys.md)。

`npm run test:combat:state`执行原EXE角色标记/数组更新与生命周期，再核对共享角色状态和服务器实际开火许可、相对浮点截止时间、普通弹丸死亡/复活及再战重置。CPU与真人已共用这条许可路径；已接入逐车TankDelay与技能重算，完整库存、装备和技能producer仍待恢复。

该检查同时覆盖原16技能槽新增/挤出/删除/移位及实际OdlPlayer六组数组绑定；共享槽位变更能接回选源和装填累加。原库存所有权、施放消息与道具消耗尚未据此实现。

`npm run test:combat:skills`核对原技能重算槽、六装备组合和十道具槽的技能展开／被动条件／排重顺序，涵盖342技能与204道具；`npm run test:combat:reload`核对原倍率、装填累加、边界换算与开火许可。实际库存和装备来源仍在恢复，对局临时装填时间尚未替换。

`npm run test:combat:reload`执行原角色装填边界与最终换算指令，核对共享模块的63组f32结果。输入是装备／技能累加后的角色字段；上游来源和网络覆盖尚未完整恢复，因此尚未替换当前服务端原型装填。

`npm run test:cpu:profile -- <CDP地址>`测量原0007地图、3CPU自主战斗的高清帧间隔、场景绘制、对局更新、HUD、动画和地图物件成本。中间960×540阶段只用于判断像素数量对性能的影响，最后恢复1920×1080；不作为降低画质后的高清验收。输出`recovery/output/browser-cpu-profile.json`，GPU计时不可用时记录null。

`npm run test:combat:inventory`对照原库存查询和删除通知：600次数量更新、12次各228记录分类/装备标记，并组合验证查询、快捷槽初始化、请求不扣数量和后续通知。真实库存账户与施放业务仍待接通，依据见[库存查询](recovery/docs/inventory-query.md)。

库存记录原位流格式已恢复：`test:combat:inventory`还核对1664次原记录编码/解码，支持16位物件ID、24位数量、8种位偏移与float原始位值；格式及查询包候选见[库存传输记录](recovery/docs/inventory-wire.md)。

完整库存查询包`0x3c8f`已恢复：`test:combat:inventory`对照40个原完整包，执行真实红黑树排序/去重与位流，解码记录进入共享库存查询。原socket封装和账户持久化仍待接通。

`npm run assets:combat`发布342原技能/204原道具的运行目录；`npm run test:combat:effect-messages`对照原播放/停止技能效果包体、原通知分支及角色队列复活/循环/5秒单次计时/清理。真实施放和账户库存仍待接通，依据见[技能效果消息](recovery/docs/skill-effect-wire.md)。

`npm run test:combat:use`对照1308原道具使用/陷阱请求许可、108角色计时与384原65位请求包，验证发请求前清陷阱许可、后续恢复、请求不扣量和包体精确读写。角色timer的秒单位已通过原相对QPC时钟和虚调用链确认，并接入World权威模拟；未知请求字段语义与真实施放仍待接通。依据见[原道具请求](recovery/docs/item-use.md)。

`npm run test:combat:configuration`恢复原七槽配置/取消请求与确认：1433配置请求、16取消请求、48确认和64完整包逐值对照。配置成功4按返回七槽整体复制并通知28/dirty；取消成功1直接清一个槽，不通知28或改dirty。请求和确认均不扣量，完整配置包驱动正常数字键分派已验证；真实账户库存/服务器确认产生/Web拖放仍待接通。依据见[快捷槽配置](recovery/docs/kitbag-configuration.md)和[原界面来源](recovery/docs/shortcut-ui-evidence.md)。

`npm run test:combat:effect-battle`验证实际TSRPC Play/Stop通知传输、战斗通知组件的30Hz倒计时、复活队列与角色/回合清理。Battle已接入生产特效backend；正式World的库存授权施放与技能通知产生仍待实现。Web帧时钟与原Sleep时钟的差异见[技能效果消息](recovery/docs/skill-effect-message.md)。

`npm run test:accounts`验证持久账户、库存隔离、七槽配置、服务端重启恢复与普通网络弹药选择。正式登录页可恢复已保存token身份、注册账号绑定当前未绑定账户，或用账号和密码登录同一持久账户；保存账号只保留账号名，不保存密码。默认SQLite位于recovery/output/accounts.sqlite，ACCOUNT_DB_PATH可覆盖。`npm run inventory:import -- <accountId> <records.json>`导入明确所有权记录，不从物品表授予库存。正式库存配置与已接通道具消费的范围见[任务清单](recovery/docs/tasklist.md)，账户来源见[账户库存](recovery/docs/account-inventory.md)。

`npm run test:combat:effect-clock`执行原406154连续调用与帧调度模块对照。Battle现使用非阻塞poll与真实秒数queue计时；原Sleep差异见技能消息文档。

开发与完成状态统一维护于[任务清单](recovery/docs/tasklist.md)，按单条验收证据勾选。正常网页“我的家：物品”进入账户库存与四格武器/道具配置；`npm run test:home:source`核对原槽映射，`npm run test:home:browser -- <CDP地址>`验证独立服务端页面操作、保存、刷新及重启恢复。完整我的家布局与原登录仍按清单待做。

`npm run test:cpu:realtime -- 21 0 5 3 --require-objective --two-rounds`验证两条独立连接、正常时限和生命的连续两局CPU实时全清、逐局结算冻结及退出清理；输出独立`cpu-realtime-21-full-two-rounds.json`。`recovery/.venv/bin/python recovery/export_skill_function_coverage.py`生成342技能、204道具及23非零函数类型逐槽来源索引；[函数开发范围](recovery/docs/skill-function-coverage.md)与tasklist的FUNC子项追踪权威函数实现。

`npm run test:playable:browser -- <CDP地址>`使用独立服务和两独立浏览器账户，沿正常页面操作建房、加入三CPU、加入第二玩家、准备、自然战斗、结算、双方再战及退出清房；输出`browser-playable-loop.json`与双方结算截图。测试降低渲染用于流程观察，不作为高清性能验收。

`npm run assets:fonts`发布原12字体定义、122位图字形映射及SIMSUN指向的MingLiU字库，并生成正式密码输入使用的源星号派生字体；`assets:ui`复用同一字体发布步骤。库存栏与HUD等待实际字体加载。`npm run test:fonts:browser -- <CDP地址>`核对字体失败重试、原中文物品标签和1080p/4K显示。原FreeType像素/度量及全部控件字体覆盖尚在M3-10验收。
