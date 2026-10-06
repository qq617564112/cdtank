# 宠物注射剂解除燃烧、有限库存与恢复

宠物注射剂3通过普通快捷槽输入解除真实2007燃烧。目标拥有角色生命600，经自然2007命中43和首个4005持续伤害70降至487，使用注射剂后持久owned及本局battle均2→1，后续持续伤害停止，生命保持487。重复使用因没有异常状态拒绝，数量保持1；两轮自然结束与同SQLite服务器实际重启保留库存1及快捷槽。

## 真实网络

`tests/pet-injection-network.cts`使用实际index3231、临时SQLite和正常Account/Kitbag/CreateRoom/Join/Autopilot/Ready。显式拥有角色复用已验源充分pet1／tank1 HP600夹具，完整字段布局来自`world-role-attributes-native.json`；没有运行生命、位置、伤害、燃烧状态、事件或结果注入。

主账户明确持有2007×1／实例77，通过Kitbag槽1配置战斗Digit2；目标明确持有注射剂3×2／实例78，通过Kitbag槽4配置战斗Digit5。mode4/map7两人房间无CPU，只有主账户托管自然发射一颗2007后正常关闭托管并发送停火输入。目标第一次4005后正常PlayerInput useItem5使用注射剂。

| 验收项 | 实测 |
| --- | --- |
| 真实异常来源 | 普通2007 fire、真实hit43、4005首周期70，目标HP600→557→487 |
| 普通解除 | target/P2使用skill3，自身roleId2、effectIndex0通知 |
| 有限持久消费 | owned2→1、battle2→1，立即读取同SQLite确认owned1 |
| 无异常重复 | itemRejected“没有需要解除的异常状态”，完整Inventory与前次相等 |
| 后续持续停止 | 观察200tick后无新增4005，HP487 |
| 双端一致 | fire、hit、ammoConsumed、itemUsed、itemRejected、finish共同事件相等 |
| 两轮 | 两次自然TIME_LIMIT，再战HP600，旧燃烧不继承 |
| 实际恢复 | 正常Leave，停止并重启同SQLite index，原token恢复owned1、hotkeys[3]=78 |

原始PASS：`recovery/output/pet-injection-network-2026-10-04T11-02-06-869Z.json`及`.log`。

## 正式双网页与原绘声消费者

`tests/browser-pet-injection.mjs`使用实际index3232、正式Vite5392、独立Chromium9592与两张隔离1280×720页面。目标普通Home点击Item页，选择宠物注射剂×2并配置槽4；主账户普通Home配置2007槽1，正常建房／加入／托管／Ready。真实首4005后目标普通Digit5使用注射剂，再次Digit5验证无异常拒绝；没有自动注射或模拟itemUsed通知。

| 验收项 | 实测 |
| --- | --- |
| 真实异常解除 | 2007自然命中43＋首4005伤70后目标HP487；Digit5产生skill3、自身roleId2通知 |
| 有限库存 | owned2→1、battle2→1；重复无异常拒绝，不再消费 |
| 生命控件 | 两页“坦克手-6e0778生命”aria-valuenow487、aria-valuemax600、title487/600 |
| 后续持续停止 | 首周期以后观察超过9秒，4005总数仍1、目标HP487 |
| 双端一致 | fire、hit、ammoConsumed、itemUsed、itemRejected、finish共9事件完全相等 |
| 原Effect18 | root2753、8树节点、7绘制节点，Tag0=tag_efcenter，父矩阵引用实际匹配目标车，once=true |
| 实际绘制 | 两页drawSubmissions／actualDraws分别128／128、125／125 |
| 原SE17 | 两页实际SE17.wav，AudioContext running、非loop，playing及ended都发生；相关声音源结束 |
| 两轮与退出 | 两次自然TIME_LIMIT，再战生命600、无旧燃烧；Leave实例0、声音源0、状态stopped |
| 实际恢复 | 停止并重启同SQLite index，原token保留；普通Home显示“宠物注射剂 ×1”、槽4实例78 |

音频引用为`audio/sound/SE17.wav`，已发布音频目录来源`CDTank/Data/sound/SE17.wav`；本轮验证实际媒体playing／ended，不扩音频峰值取样。截图记录真实目标车的原光柱／光环、本人生命条、注射成功和无异常拒绝反馈。

原始PASS：`recovery/output/browser-pet-injection-business-2026-10-04T11-03-19-161Z.json`及`.log`。唯一对应道具效果截图：`recovery/output/browser-pet-injection-business-2026-10-04T11-03-19-161Z-injection.png`。

## 来源与业务范围

原item3／skill3为宠物注射剂，函数type10，原Effect18、Tag0和SE17。服务器自用解除与持久消费为重建权威，当前已交付异常仅真实2007 burn；本片不宣称“所有异常”实现。正面饮料与无敌不清除由独立规则覆盖，没有重复其旧业务。item3尚未开放购买，本片持有记录为明确测试夹具。

原事务持久rawbattle字段沿用保存布局，重启owned1为权威，下局battle按owned初始化；raw字段2不表示补回消耗。原2007绘声及自然死亡有效证据复用`ammo07-burn-network-browser.md`，本片只新增注射剂解除与自身Effect18／SE17正式消费者。

## 自然效果结束

定向正常输入记录`browser-pet-injection.mjs --effect-expiry-only`复用普通2007真实燃烧、目标Digit5注射及实际Effect18绘制，随后两页在仍PLAYING时观察已产生handle3均不在EffectRuntime.instances，remaining空、voices0、SE17 ended=true，再正常Leave。未重复两局、重启或截图。

原始PASS：`recovery/output/browser-pet-injection-effect-expiry-2026-10-04T11-06-24-995Z.json`及`.log`。

## 已知边界

原2001完整FX阶段仍独立开放，本片仅为注射剂自身原Effect18／SE17及已交付burn解除，不代表普通弹全链完成。

## 清理

正常Leave，断开网络，关闭index、Vite及Chromium，删除专属SQLite和浏览器临时目录。3231、3232、5392、9592无监听进程，`/tmp/cdtank-pet-injection-*`无残留。网络和双网页各首次完整运行PASS；自然效果结束定向记录PASS，独立runId保存。

正式注射剂同时支持已交付黏胶弹减速。`pet-injection-slow-player-accepted.json`限定接受正常购买/配置/自然命中/useItem5后的实际速度130→70→130、生命655不变、库存2→1、无异常重复拒绝、双端112共同tick与两次正常Leave。持久消费仍先于状态清除；失败不清burn/slow、技能或移动。正面skill6与合并burn/slow由八局部条件验证，原18/SE17绘声与重启范围沿上列有效证据复用。此扩展不证明原Func10全部异常或AI仅slow时自动用药资格。
