# 2011 有限弹药真实业务验收

实际服务器与正式双网页的2011有限消耗业务闭环通过。同一网页消费账户完成两发扣减、空量拒绝、默认发射、两轮自然结算、再战和实际重启后的可见库存恢复。原绘声消费者证据复用2011消费观察与一次短诊断，不把本次业务运行声明为重新完成完整绘声验收。

网络两发问候炮弹逐发扣减2→1→0，第三次空量发射拒绝且切回默认弹，不产生发射或重载；随后正常默认弹发射不扣库存。同房两轮自然结算和再战不补弹，实际服务重启保留拥有者库存0、另一账户库存2及已配置快捷槽。全部库存消费使用正常接口和持久账户，没有注入生命、位置、伤害、事件或胜负。

## 真实网络

`tests/ammo11-consumption-network.cts` 使用实际 index3220、临时SQLite、四条正常WebSocket连接。复用 `browser-combat-muzzle-2011.mjs` 的明确拥有角色fixture：`world-role-attributes-native.json tank1/part0`，两账户拥有坦克实例72，2011弹药实例77的ownedQuantity2、原持久battleQuantity2。两账户正常Kitbag ASSIGN slot1配置战斗Digit2，两人和一个CPU正常mode4/map7房间Ready。

| 验收项 | 实测 |
| --- | --- |
| 两次合法2011发射 | fire2011恰好2次，ammoConsumed剩量依次1、0；每次内存owned/battle均扣1，持久owned扣1 |
| 最后一发 | 数量0后当前确认仍2011，保留合法末发 |
| 空量请求 | itemRejected，确认切2001；没有fire，reload状态不变 |
| 默认弹 | 新正常输入fire2001一次，持久owned仍0 |
| 真实CAS冲突 | 同token另一正常房先加载本局量2；主房两发使持久owned0后，另一房正常发射被CAS拒绝，保持2011/本局量2，无fire/reload |
| 两轮自然战斗 | 两轮均tick598，合法30秒TIME_LIMIT；48fire、41hit、8destroy、6respawn |
| 再战库存 | round2本局库存0/0，默认确认2001，不补回2011弹药 |
| 双端/大厅隔离 | 拥有者消费、发射及拒绝事件两端一致；大厅第三账户0房事件/快照 |
| 实际重启 | 停止并重新启动index，原token正常Account/Inventory；拥有者owned0，另一账户owned2，快捷槽首项均77 |
| 重启后开局 | 正常CreateRoom/Ready后，拥有者本局owned0/battle0 |

有效完整原始记录为 `recovery/output/ammo11-consumption-network-2026-10-04T09-42-07-224Z.json` 及同名前缀 `.log`。CAS证据来自正常同账户多连接和两个合法房间，不改数据库构造冲突。

## 正式双网页

### 同一消费账户业务生命周期

`tests/browser-ammo11-consumption.mjs --business-only` 的完整限定PASS记录为 `recovery/output/browser-ammo11-consumption-business-2026-10-04T10-06-46-806Z.json`及同名前缀`.log`，scope为`same-account consumption lifecycle, rendering reused`。正式Home可见问候炮弹×2通过鼠标配置槽77；真实Digit2/Space发射2011恰好两次、数量2→1→0，最后确认2011，空量请求拒绝且reload不变，随后2001恰好一次，持久库存不再扣减。另一页面自己的数量保持2。

同一消费数据库与原账户token继续首轮tick596自然30秒TIME_LIMIT，正常两票Rematch后本局0/2、默认确认2001；第二轮tick597自然TIME_LIMIT后正常Leave。实际停止并重启同一数据库的index，两页reload保留原token，正常Home显示问候炮弹×0/×2与快捷槽77。两页121个自然业务事件一致：52fire、47hit、2ammoConsumed、1itemRejected、9destroy、8respawn、2finish。退出效果实例0、音源0、声音状态stopped。

本次只补此前未贯穿的同消费账户网页持久终点，不等待绘声、不拍像素图、不追加炮弹、不重跑网络。原2011特殊绘声见以下原消费记录；默认2001双页root2429五图元提交、GA07声音来源见 `browser-ammo11-muzzle-diagnostic-2026-10-04T10-03-08-850Z.json`及 `ammo11-muzzle-diagnostic.md`。原FAIL记录保持不变。


2011消费网页的有效范围分别保存在两个完整FAIL原始记录中：`browser-ammo11-consumption-2026-10-04T09-43-13-676Z.json`和`browser-ammo11-consumption-2026-10-04T09-45-14-262Z.json`及同名前缀日志、失败截图。两次均以实际index3221、正式Vite5381、独立Chromium9581及两个隔离1280×720页面运行。正常“我的家”鼠标配置2011×2快捷槽、建房mode4/map7、房间卡加入、CPU添加、Ready、真实Digit2/Space完成两颗消耗与空量/default业务。

| 验收项 | 实测范围 |
| --- | --- |
| 可见拥有者数量 | local特殊槽2→1→0；另一页自己的local数量保持2 |
| 持久扣减 | 两次合法2011发射逐次持久owned减1；第三次空量拒绝，reload不变，随后2001正常发射 |
| 2011绘声依赖 | 两页P1的root3004图元实际提交并自然到期，GA08/sound49非零输出并自然结束；节点覆盖沿用已有053源证据 |
| 默认绘声 | 两页P1真实2001/GA07(sound48)声音输出；09-45另一页没有观察到P1 root2429图元实例，默认视觉补验不通过 |
| 原消费网页生命周期 | 两次均正常首轮TIME_LIMIT；原脚本在绘声等待处停止，其记录不声称同账户网页Rematch/重启 |

原两个消费网页数据库由各次finally清理，后续网页生命周期采用独立fixture和独立runId。网络完整记录证明同库消费→实际重启owned0的因果；独立网页fixture仅证明可见零库存的再战/恢复资格，不声明接续原消费账户。网页绘声消费者未改，降低Babylon raster resolution，保留页面、相机和输入。本片不重复源炮口1:1验收，不将原FAIL改成PASS。

### 独立零库存网页生命周期

`browser-ammo11-consumption-lifecycle-2026-10-04T09-48-42-821Z.json`及同前缀`.log`、`-restart-1/2.png`为独立fixture限定PASS。明确拥有角色源保持一致，预配置合法快捷槽77，拥有者fixture导入owned0/rawbattle2、另一账户owned2/rawbattle2；不声称两颗曾在该账户中发射。页面正常“我的家”显示问候炮弹×0/×2，正常两人+一个CPU开局。

两轮均tick597自然30秒TIME_LIMIT，正常两票Rematch后本局数量0/2保持不变，默认确认2001；两页第二轮结算后正常Leave。实际停止并重新启动同一独立fixture服务器、页面reload保留原token，“我的家”仍可见×0/×2和槽77。效果实例0、声音源0、声音状态stopped，完整连接和临时目录正常清理。此记录证明零库存页面的自然两轮、再战、实际重启和可见恢复，不合并成原消费网页同一账户运行。

## 已知边界

有限2011消耗、空量切默认、持久CAS与再战不补库存属于明确重建规则，未声明原服务器耗弹资格。持久raw battleQuantity为导入原字段2，消费只写持久owned数量；WAITING可保留raw字段，PLAYING初始化再依据owned生成实际本局量0。这一字段不等于剩余拥有数量，不把重启raw2误写成补弹。

一个被接受的空量输入被清fire；网页后续独立普通输入包可发默认弹。本次使用短Space操作验证拒绝，无“必须松开后才可默认发射”的规则声明。持久false冲突由真实网络覆盖，持久throw由专属规则证据覆盖，不把throw声称为真实数据库故障验收。仅本片2011、mode4/map7、明确拥有tank1与有限2颗fixture；其他弹药、其他地图和完整原量规则不扩张声明。

## 清理

正常Leave、断开连接、关闭index/Vite/Chromium、删除临时SQLite与浏览器目录。交付时3220、3221、5381、9581均无监听进程。每次执行输出独立runId，完整失败记录保留，不覆盖有效或失败原始记录。
