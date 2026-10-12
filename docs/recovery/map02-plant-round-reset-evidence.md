# Map02 Plant327 正常再战恢复

M3-05/M7-02：`browser-map02-full-session-2026-10-05T18-09-00-638Z.json` 保持 INCOMPLETE，唯一failure为 `Host source327 new-round actual draw missing`。本次复用正式Plant来源、NAV和type100接触，不追加来源/底层检查或截图。

实际主审 `map02-plant-round-reset-root-review.json` / `ACCEPTED_FINITE_DUAL_PLANT327_ROUND_RESET_GUEST_DRAW_HOST_DRAW_GAP`，runner66822实际出口0，root亲3595/5625/9825三空。有限wrapper为 `map02-plant-round-reset-player-evidence.json`。191共同tick全部匹配；本次原门禁与主端draw缺口保留。

四认证账户中两端渲染、两端被动；渲染账户沿已明确的预房native tank1/pet1夹具，不声明取得流程。Map02/mode2保持原玩法规则，普通W/A/D导航触碰source327后隐藏，普通Autopilot自然OBJECTIVE终局wall44555ms，正常Rematch进入round2并观察5s，再正常双Leave。

## 实际恢复范围

| 端 | 同一scene revision | Round1隐藏帧 | Round2恢复帧 | Round2实际绘制 |
|---|---:|---:|---:|---|
| host | 1 | 388 | 445 | 未观察到 |
| guest | 1 | 258 | 316 | 4次，frame320至323 |

两端source327均从hidden=true/rootEnabled=false恢复为下一round hidden=false/rootEnabled=true，sourceEnabled=true且29roots保持。状态由正式快照reconcile恢复，不注入事件或主动draw。客端重新绘制按sourcePlantSway327、相同revision和新round真实onBeforeRender归属；没有独立像素证据。

正常双Leave后的players/breakables/plantRoots/plantSnapshots/effects/sceneVoices/treeVoices/battleVoices全部0，plantRound与world为null，inputIntervalActive=false。connectionEvents为空。

## 限制

主端恢复后的实际绘制缺口保留，不由rootEnabled=true代替draw，不将客端绘制移作主端证据。当前记录不证明完整原GPU表现、HD性能、主动重连或Map02整图完成。原raw不改PASS，不自动追加运行。
