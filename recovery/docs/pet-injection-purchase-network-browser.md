# 宠物注射剂购买实例与解除持久链

原Item3商店购买所得实例接入真实燃烧解除与账户持久恢复的网络闭环通过。商品原价10金币／10软星币，目标初始空库存，持有角色和实验资金明确导入；注射剂库存只由真实BUY分配。

`tests/pet-injection-purchase-network.cts`使用独立index3233、临时SQLite与四个正常账户。发射账户仅明确持有2007×1，目标以实验资金100金币购买注射剂×2；另一个空库存账户以40软星币独立购买×2，资金不足账户5金币／0软星币购买拒绝。购买新实例通过正常Kitbag配置槽4／战斗Digit5，正常Autopilot2007发射后关闭停火，真实命中43和首4005伤70后以普通useItem5解除。

`tests/browser-pet-injection-purchase.mjs`使用index3234、正式Vite5394、独立Chromium9594和两张隔离页面。目标普通商店Item选择3、BUY×2、Home动态新实例槽4、普通Digit5；正式Effect18／SE17消费者、生命控件、正常Leave和同SQLite服务器实际重启属于本片购买链。

拥有角色复用已验源充分pet1／tank1 HP600夹具与`world-role-attributes-native.json`完整字段布局，base0x2c=600／equipment攻击100经正常属性重算。没有运行生命、位置、伤害、燃烧、事件或结果注入。商店分配、扣款和注射剂自用解除权威为重建业务；原Item3价格、图标、说明以及skill3Effect18／SE17来自原资源。

两轮自然终局及Effect18独立自然到期直接依赖`pet-injection-network-browser.md`有效记录，本片不重复该验收；普通2001全FX阶段仍独立开放。

## 真实网络结果

| 项目 | 实测 |
| --- | --- |
| 原价商品 | item3 MONEY10／TOKENS10 |
| 目标金币购买 | 初始空库存，MONEY100→80，BUY2分配实例1、owned2／rawbattle0 |
| 独立软星币购买 | 初始空库存，TOKENS40→20、MONEY0，另一账户实例1 owned2 |
| 幂等与冲突 | 同请求重放replayed=true，无重复扣款；同key数量改为1拒绝 |
| 余额不足 | 第四账户MONEY5／TOKENS0购买拒绝，库存空、余额不变 |
| 普通使用 | 实际2007命中43＋首4005伤70，目标HP487，普通useItem5购买实例2→1 |
| 持久与解除 | 当局battle1，SQLite owned1；重复无异常拒绝，200ticks后无新增4005、HP487 |
| 双端一致 | 共同fire、hit、ammoConsumed、itemUsed、itemRejected共6事件相等 |
| 正常退出与重启 | 短链Leave，停止并重启同SQLite服务器、原token；目标owned1、槽4实例1、余额80／0 |
| 账户隔离恢复 | tokenbuyer owned2、未配置槽、余额0／20；不足账户空库存5／0 |

原始PASS：`recovery/output/pet-injection-purchase-network-2026-10-04T11-18-15-682Z.json`及`.log`。

## 正式双网页结果

| 项目 | 实测 |
| --- | --- |
| 普通Item购买 | 原商品3、10金币／10软星币，BUY2返回实例1，余额80／0，成功提示×2 |
| 真实新实例 | 普通Home选择新实例1，槽4对应战斗Digit5 |
| 普通解除与数量 | 自然2007伤43、4005首70后普通Digit5，注射剂owned／battle2→1；再用无异常拒绝 |
| 玩家生命控件 | 两页目标“坦克手-e65d70生命”aria-valuenow487、aria-valuemax600、title487/600；后续无新增4005 |
| 双端共同消息 | Leave之前6个fire、hit、ammoConsumed、itemUsed、itemRejected完整相等 |
| 原Effect18 | root2753、8树节点、7绘制节点，Tag0=tag_efcenter，实际父矩阵引用匹配目标车，once=true |
| 实际绘声 | 两页drawSubmissions／actualDraws均137／137；SE17.wav、context running、非loop、playing与ended发生 |
| 正常Leave | 两页实例0、声音源0、声音状态stopped |
| 实际同DB恢复 | 原token保持，普通Home“宠物注射剂 ×1”、槽4实例1；商店金币80／软星币0 |

原始PASS：`recovery/output/browser-pet-injection-purchase-business-2026-10-04T11-18-44-384Z.json`及`.log`。购买整页截图：`recovery/output/browser-pet-injection-purchase-business-2026-10-04T11-18-44-384Z-purchased.png`。注射实际绘制截图：`recovery/output/browser-pet-injection-purchase-business-2026-10-04T11-18-44-384Z-injection.png`。

原声音引用`audio/sound/SE17.wav`来源`CDTank/Data/sound/SE17.wav`。本购买链只检查对应消费者的实际draw、媒体playing／ended与退出清理；原18自然到期与两局证据复用，不扩大为音频峰值或普通2001全FX验证。

## 清理

正常Leave并断开网络，关闭index、Vite及Chromium，删除专属SQLite和浏览器临时目录。3233、3234、5394、9594均无监听进程，`/tmp/cdtank-pet-injection-purchase-*`无残留。网络与网页各首次完整运行PASS，原始记录按独立runId保存。
