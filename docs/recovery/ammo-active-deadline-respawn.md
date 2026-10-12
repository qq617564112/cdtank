# 普通末发活跃装填期限与自然复活

M2-02/M2-03 既有特殊弹复活验收已证明正常死亡后回2001与计算弹匣。原独立验收明确旧装填期限在复活前已过，因此尚不证明仍活跃期限的提前清理。本片已用唯一首次正常网络运行证明该未覆盖条件，actualsession38968 exit0。

`tests/ammo-active-deadline-respawn-network.cts` 使用 Pet105 实际购买学习保存的双账户，0BUY/LEARN/资金/Point/owned改写。原计算提供7发容量、普通1.5秒与末发4.5秒。普通peer2001自然命中形成单次致死缺血；其自然critical由同hitbool决定damage，最多40次准备命中，提前死亡时正常Leave/新房恢复已有初始视线，不写活跃HP或固定RNG。本人炮塔向背离对手方向正常射完7发，车体仍正面承受对方来向。末发后4.5秒期限仍活跃时对手自然致死，3秒自然复活必须先于该旧期限。

验收断言同时保留服务器毫秒 deadline、快照tick×.05模拟秒和接收墙钟。旧deadline仍未来时，新生命 reload startedAt/duration/remaining应全部0，默认2001计算7发填满，新普通fire必须实际早于被取消的旧期限，双端同fire事件一致，扣发并安装原1.5秒；保存每次正常PlayerInput及其room/player/观测tick/墙钟。双端按room/round/phase/tick/serverTime比较完整快照，最后正常Leave和双账户完整四QUERY保持；没有新native或旧重启矩阵。

3651在主线独立释放后复用compiled36447运行；专属final targettypes session31930实际exit0，不重build/pure/native。复活默认配给与清理为既有Web生命周期政策；原普通2001数值公式沿原表与重算。完整车型/装备/原server父范围保持开放。

正式路径为 `advanceActors` 的 `respawnAt` 门禁 → World respawn handler → `respawnPlayer` 的 `combat.setStatus(2)` 与 `resetConfirmedAmmo` → 清除 nextAvailableSeconds/reloadDuration/reloadStartedAt 及弹匣 defaultCount/refillAt → `recomputeBattleAttributes` 按原公式初始化默认弹匣。新普通输入序号保持递增，复活本身使用现随机原出生点，不固定位置。当前代码具备该重置路径，活跃旧期限的实际消费者已由本片有限实网证明；完整原服务端生命周期与父范围仍未完成。

## 实际结果

raw `ammo-active-deadline-respawn-network-2026-10-05T23-41-38-008Z.json`：5次正常准备命中使本人HP14。tick492本人末发0/7、reload4.5；tick493对手自然致死，旧装填startedAt保持。tick553自然复活HP700、7/7，reload startedAt/duration/remaining全0；此时模拟距末发3.05秒，服务器3056ms，接收墙钟3056ms，均早于旧4.5秒期限。tick554本人真实freshfire扣至6/7并使用普通1.5秒，新fire startedAt距旧末发3106ms，旧期限仍余1394ms。

554个共同完整samekey快照全等，所验生命周期fire/hit/destroy/respawn/fire事件双同；两次正常Leave后双账户完整四QUERY不变。finally保存204800B checkpoint和0600私密身份、删除临时库并停止服务，3651监听为空。汇总为 `recovery/output/ammo-active-deadline-respawn-network-analysis.json`，独立主审 `recovery/output/ammo-active-deadline-respawn-root-review.json` 状态为 `PASS_FINITE_ORDINARY_ACTIVE_LAST_DEADLINE_NATURAL_DEATH_RESPAWN_RESET_FRESH_FIRE_DUAL_STATE_LEAVE_SCOPE`。本片没有新增native、重启或网页范围。
