# 托管自动注射剂解除链

本片验证持久账户普通Home／Kitbag配置注射剂后，由本人的托管控制器在真实2007燃烧状态中自主选择普通快捷槽输入，消费库存并解除。人工输入仅用于关闭托管后的正常接管，不触发注射剂。

`tests/pet-injection-ai-network.cts`使用index3235、正常两玩家mode4/map7与临时SQLite。明确source充分pet1／tank1 HP600夹具、发射方2007×1／实例77槽1、目标注射剂3×1／实例78槽4；完整字段布局复用`world-role-attributes-native.json`，没有运行生命、位置、伤害、burn、事件或结果注入。普通Autopilot自然发射后发射方关闭停火，目标保持自己的Autopilot到自主item3施放。网络覆盖两轮自然30秒与实际同DB原token恢复。

`tests/browser-pet-injection-ai.mjs`使用index3236、正式Vite5396、独立Chromium9596和两张隔离页面。普通Home配置与点击托管，实际事件与原18／SE17消费者接收自主施放；随后普通点击关闭目标托管，普通KeyW前进并松开证明人工接管。没有Digit5输入或自动注射按钮。

AI异常优先选择策略和持久自用权威为重建业务；原skill3Effect18／SE17资源、普通2007消费绘声、注射剂自然效果到期和购买链来源复用既有有效记录。这里只涉及持久玩家账户Autopilot，房间CPU没有网络库存配置API，不将其等同网页CPU业务。

## 真实网络结果

| 项目 | 实测 |
| --- | --- |
| 真实异常因果 | tick71，普通2007命中目标43；tick72，目标自己的Autopilot使用skill3 |
| 自主持久消费 | 目标注射剂owned1→0、battle1→0，直接SQLite读取owned0 |
| 持续停止 | 后续无4005，目标HP600−43=557 |
| 普通人工接管 | 关闭目标托管，人工sequence1前进／useItem0，实际位移约98；sequence2停步，无人工注射快捷槽 |
| 两轮自然终局 | 两次合法30秒TIME_LIMIT，再战注射剂owned0／battle0不补量 |
| 双端一致 | fire、hit、ammoConsumed、itemUsed、itemRejected、finish共20共同事件相等 |
| 实际恢复 | 正常Leave，关闭重启同SQLite index；原token恢复owned0、hotkeys[3]=78 |

原始PASS：`recovery/output/pet-injection-ai-network-2026-10-04T11-28-28-916Z.json`及`.log`。

AI输入由服务端同controller经普通权威入口处理，没有客户端AI PlayerInput网络包。客户端人工输入均useItem0，item3确认事件来自实际2007命中后的自主选择。

持久rawbattle字段1为原保存字段；实际第二轮Ready按owned0初始化battle0。重启owned0为权威，raw字段1不代表补回弹药或道具。

## 正式双网页结果

| 项目 | 实测 |
| --- | --- |
| 本人账户配置 | 普通Home注射剂×1、槽4实例78；正常点击Autopilot |
| 真实自主因果 | 普通2007命中43后目标自己的controller使用skill3，自身roleId2确认 |
| 持有与生命 | owned1→0、battle1→0；两页“坦克手-e245b8生命”aria557／600、title557/600，后续无4005 |
| 人工快捷槽 | sent PlayerInput中useItem5数量0，没有人工触发注射剂 |
| 普通人工接管 | 等待关闭托管确认、普通收起控制面板，KeyW前进并松开，15个move1普通输入、实际位移约98 |
| 双端一致 | Leave前fire、hit、ammoConsumed、itemUsed、itemRejected共24个共同事件相等 |
| 原Effect18 | root2753、8树节点、7绘制节点、Tag0=tag_efcenter，目标车父矩阵引用匹配，once=true |
| 实际绘声 | 两页drawSubmissions／actualDraws113／113及110／110；SE17.wav、running、非loop、playing与ended发生 |
| 正常Leave | 两页效果实例0、声音源0、状态stopped |

有效原始PASS：`recovery/output/browser-pet-injection-ai-business-2026-10-04T11-32-30-707Z.json`及`.log`。自主施放实际效果截图：`recovery/output/browser-pet-injection-ai-business-2026-10-04T11-32-30-707Z-injection.png`，在目标关闭托管和人工前进之前保存。

网络承担本新自主链两局及持久恢复；网页只验真实自主消费者、人工接管与清理。注射剂原效果自然到期依赖`pet-injection-network-browser.md`有效定向记录，购买链依赖`pet-injection-purchase-network-browser.md`，不重跑该业务。

## 已知边界

较早网页原始FAIL记录`browser-pet-injection-ai-business-2026-10-04T11-29-48-737Z.json`保留；它已取得自主施放与库存0，但在人工前进检查结束，不能作为完整网页链。有效记录仅以上完整PASS。这里只验证已交付2007燃烧，原所有异常完整范围仍独立开放；普通2001完整FX仍独立开放。

## 清理

正常Leave并断开网络，关闭index、Vite及Chromium，删除专属SQLite与浏览器临时目录。3235、3236、5396、9596无监听进程，`/tmp/cdtank-pet-injection-ai-*`无残留。网络PASS、有效网页PASS与较早FAIL按独立runId保存。
