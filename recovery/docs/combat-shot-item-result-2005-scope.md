# 2005远端场景结果呈现

正式2005首致死场景结果已接远端消费者。TankShotItemResult先按原4004首槽播放world009与二维SE32，再由BattleSound播放GA10；本机结果保持静默。新消费端检查和Web类型检查通过，普通ENV79首致死事务触发远端009五节点实际提交与SE32/GA10自然结束；本机结果零树、零声音、零反馈。三完整320画布可辨黄白/橙色爆光，普通双Leave及effect/声音资源归零已验证。

原通用4247aa远端分支将结果端点传423956、物件ID传423092，本机比较后跳过。原2005第二技能4004首槽选择009/SE32，原Shot反馈GA10；复用scene-breach21-hit-native.json、combat-shot-player-result-2005-source.json、combat-shot-player-result-2003-source/runtime及2003场景结果来源。资源、native及既有受害者验收不重复。

正式玩家验证为正常BUY2005、Home武器槽1、合法map7普通Space自然摧毁场景对象，通过冻结2005与真实事务端点触发远端world009、二维SE32及射手位置GA10。本机结果静默，原时机结束后普通双Leave。Fx仅拥有shot-item-result.ts与battle-sound.ts的精确2005资格、独立新验收和文档；producer、Shop、伤害和场景生命周期归主线，两处守卫仅追加2005，来源映射检查见combat-shot-item-result-2005.json，Web类型检查见ammo2005-scene-consumer-web-type.log。

主线接口仅沿既有首致死scene/objective事务原型冻结2005与事件端点；不扩大到非致死、terrain、动态碰撞或普通场景无事务通知。若当前规则需额外授权，以主线有限重建资格为准，不从4004的Func15或说明推导新的爆风HP-100和范围伤害。

## 四层状态

| 层次 | 当前证据 |
| --- | --- |
| 原来源 | 已有通用远端分派、2005→4004→009/SE32与GA10来源复用 |
| 模块 | TankShotDisplay可按原第二技能选择009；两正式guard已接2005；新consumer检查PASS |
| 普通触发 | 主线首致死scene/objective冻结资格及普通World检查PASS；真实BUY2005×10、Home槽1/Digit2、四账户Ready、普通Arrow/Space首致死ENV79事件已验证 |
| 双端可辨/可听 | 远端三完整320画布爆光可辨；SE32峰1.008077383、GA10 postgain峰0.529266059自然结束；本机静默 |

## 限制

Func15爆风作用、原伤害/破坏/飞行规则、objective实际、完整弹种、独立节点像素及HD父项未完成。本项仅首致死场景/objective事务资格；实际目标为ENV79。已有普通2001基础链与2002–2004结果实际直接复用。

## 实际证据

`combat-shot-item-result-2005-actual.json`回链普通采购/配置、真实冻结端点、五节点render callback、三完整画布和两个声音自然结束。表现证据来自07-32-33原始记录；普通退出证据来自07-38-54的`PASS_NORMAL_LEAVE_TAIL`。

host从战斗页`data-leave-room`返回大厅；guest进入结算后，从原`game_summary.xml`的`btnClose`（`data-summary-leave`）调用正式Leave返回大厅。双端world清空，effect实例、mesh和声音voice均为0，BattleSound为stopped。专属3518/5548/9748全空，Chrome/Vite/server/temp清理完成。

主线组合主审：`combat-shot-item-result-2005-root-review.json`，`ACCEPTED_NORMAL2005_SCENE_REMOTE_PRESENTATION_DUAL_LEAVE_SCOPE`。表现与声音用原07-32记录，普通双退出用07-38记录；M4-09/M4-10原位由主线登记。
