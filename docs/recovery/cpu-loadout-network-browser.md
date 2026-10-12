# 准备阶段CPU有限配给与自主注射

本片验证房主在WAITING通过认证Cpu CONFIGURE给CPU配置有限2007弹药与注射剂3，真实CPU普通控制器自然发射并自主解除燃烧。CPU库存为房间临时配给，与所有持久账户库存、资金及快捷槽独立。

`tests/cpu-loadout-network.cts`使用index3237，两个明确源充分HP600玩家账户，各持有治疗道具2×2、槽4、资金100金币／40软星币。房主正常ADD三个CPU，逐个CONFIGURE槽2的2007×2和槽5的注射剂3×2，没有运行生命、位置、伤害、事件或结果注入。CPU生命与状态使用正常生成值。

`tests/browser-cpu-loadout.mjs`使用index3238、正式Vite5398、独立Chromium9598与两张隔离页面。房主普通点击添加CPU并用实际配给编辑器选择2007、注射剂和数量2；另一玩家无房主配置入口。正式CPU自主施放后的Effect18／SE17消费者与普通Leave属于本次网页范围，网络承担两局、真人持久消费回归与实际重启。

公开RoomSnapshot没有burn字段。本片以真实2007 fire、同目标hit、CPU自主itemUsed skill3确认及数量减少证明限定解除路径：正式applyPetInjection仅在burn存在并完成消费确认后发送该事件。既有burn规则及World真实到期／死亡记录来自`ammo07-burn-network-browser.md`；不宣称公开快照直接观察了burn前后字段。

原Effect18／SE17直接复用已交付消费者，注射剂不代表普通弹全FX链恢复。非法槽、超最大数量与真人目标配置拒绝由独立规则覆盖；本片认证网络只增加房主／准备阶段／错误轮次／原子拒绝的实际证据。

## 真实网络结果

| 项目 | 实测 |
| --- | --- |
| 正式CPU配给 | 房主给3CPU各槽2 2007×2、槽5注射剂3×2，正常Ready |
| 认证与阶段拒绝 | 非房主、重复槽、错误轮次CONFIGURE拒绝；准备CPU配给及readyPlayerIds[P3,P4,P5]不变；PLAYING CONFIGURE拒绝 |
| 自然CPU因果 | tick50真实hit目标P3，tick51 CPU3自身skill3／roleId3；对应2007普通fire已记录 |
| 有限数量 | 首CPU自用后P3注射剂2→1、2007已耗至0 |
| 两轮余量 | 首轮结束P3/P4注射剂0、P5注射剂2；三CPU2007均0，再战保持该余量，两个自然TIME_LIMIT |
| 真人持久回归 | 真人P2自然受伤，普通useItem5使用大包饲料2，恢复129生命；owned2→1且即时SQLite读取1 |
| 账户隔离 | 配给后两真人原库存2、槽4实例78、余额100／40不变；仅实际治疗者消费1 |
| 实际同DB重启 | 原token账户恢复：P1 owned2、P2 owned1；双方槽78、余额100／40不变 |
| 临时CPU清理 | 正常Leave并重启后新房ADD CPU默认无配给；正常REMOVE删除；正常Leave |

原始PASS：`recovery/output/cpu-loadout-network-2026-10-04T11-54-12-158Z.json`及`.log`。持久rawbattle字段保留原2，剩余owned1是权威；原保存字段不代表真人补量。CPU临时记录不写持久AccountStore。

## 正式网页与双端消费者

有效记录`recovery/output/browser-cpu-loadout-business-2026-10-04T12-01-53-494Z.json`及`.log`通过普通配给编辑器给3CPU配置2007×15、注射剂3×5，分别为原battleUseMax上限；该网页有限量与网络2／2不同，增加自然施放机会。两名玩家在Ready后分别用普通KeyD转向约4秒并松开，正常车体转向及相机跟随令邻近CPU交战进入视野，没有相机或pose注入。

| 验收项 | 实测 |
| --- | --- |
| 正式普通配置 | 房主普通select／quantity／确认配给，另一玩家无配置入口 |
| 真实CPU因果 | CPU4普通2007命中CPU3伤43，CPU3自主skill3、自身roleId3确认 |
| 有限扣量 | 可读CPU配给真实减少；afterCPUUse中P3注射剂0、P4注射剂0、P5注射剂5，弹药分别6／8／8 |
| 双端原Effect18 | root2753、8树节点、7绘制节点、Tag0=tag_efcenter、实际父矩阵引用匹配；有效树首次接收为12／3次 |
| 实际绘制 | 两端drawSubmissions／actualDraws1382／1382和344／344 |
| 原SE17 | 两页各15个SE17.wav声音，context running、非loop、实际playing／ended |
| 共同消息 | 已共同接收的146个fire／hit／ammoConsumed／itemUsed／itemRejected前缀严格相等，含CPU自主注射 |
| 正常Leave | 两页实例0、声音源0、声音状态stopped |

配置整页为同runId的`-configured.png`。双页正常画面为`-cpu-injection-1.png`及`-cpu-injection-2.png`；第二张有CPU5使用反馈和远处CPU白光，第一张正常交战视野未清楚捕获注射光环。双端实际绘制以消费者记录为证，截图不作逐帧效果绑定证明。

## 已知边界

公开快照不直接提供burn。CPU自主itemUsed3的正式burn门禁、消费后数量和真实火弹命中构成限定解除证据。网页有部分早期Effect18句柄0记录；有效原树、实际绘制及播放以同一PASS记录中的成功句柄为准。

原始整体FAIL记录`browser-cpu-loadout-business-2026-10-04T11-54-12-256Z.json`及`11-56-25-608Z.json`保留，分别止于页面控制可达性与初始普通镜头下实际绘制观察；完整网页消费者证据仅以上有效PASS。普通2001射击视觉全链仍独立开放，注射效果不代替基础射击链。

网络cpuCausal.beforeUse为事件接收时最近snapshot，广播顺序可使其已含消费后quantity1；不称为严格使用前或burn字段直接观测。独立configured snapshot为初始quantity2，afterCPUUse为消费后quantity1，确认事件提供实际解除门禁因果。

## 清理

所有已启动index、Vite、Chromium与连接已停止，专属临时SQLite及浏览器目录已删除。3237、3238、5398、9598无监听进程，`/tmp/cdtank-cpu-loadout-*`无残留。网络PASS、有效网页PASS、原始FAIL与画面独立保存。
