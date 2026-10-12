# 普通2001基础射击表现现范围

地图0007普通2001的已恢复基础射击表现均有正式消费者及有效验收，不需要追加通用爆炸、烟雾或飞行实体。

| 环节 | 原来源 | 正式消费者 | 普通玩家触发 | 双端实际绘制/声音证据 |
| --- | --- | --- | --- | --- |
| 开火03与炮口004 | BeforeShot422f25→42282e；tank001 ELK 03/attack1→004/tag_efattack | `apps/web/src/render/battle-players.ts` fire；`assets/tanks/tank-view.ts` fire/动作消息；`render/effects/runtime/effect-runtime.ts` message | map7默认2001，普通Space或CPU正常fire | `recovery/output/browser-combat-muzzle-2001.json`：同17fire，两端同炮口实例完整五节点实绘、实时矩阵与自然结束；实际页muzzle-2001-1/2.png |
| 开火GA07 | 423092→owner+8c→4cefc9，普通2001选择GA07 | `apps/web/src/audio/battle-sound.ts` event | 同一正常fire | 同muzzle-2001.json，两端真实AudioBufferSource非循环、自然ended |
| 即时SCENE/FREE世界端点 | 4288fe→423956→489ba8→45afc2/4858f2；PLAYER分派无世界端点 | `apps/web/src/assets/tanks/shot-display.ts` show；EffectRuntime world007/二维SE30 | map7普通2001正常目标查询选择SCENE或FREE | `recovery/output/browser-combat-nosphere.json`：两端51fire（FREE12/SCENE31/PLAYER8）；FREE/SCENE007五节点实绘及自然结束，二维SE30真实ended；PLAYER无该入口请求 |
| 玩家结果007与空间SE30 | ShotPlayer3aa3→424614→4886aa；victim tag0/binding3，431fe0读role+25c | `apps/web/src/assets/tanks/shot-player-result.ts` showPlayerResult；EffectRuntime spawnAttachedEffect/playSkillSound | map7模式4普通2001命中真实玩家，合法hit携带shotPlayerResult，先于hurt | `recovery/output/browser-combat-shot-player-result-2026-10-04T13-54-00-875Z.json`：各8结果，本机/其他受害者均发生；同值hit双端007五节点实绘/tag_efcenter/自然结束，空间SE30真实playing/ended及音频输出；native来源`combat-shot-player-result-native.json` |
| 普通hurt05–08 | 4288fe→435745角度分类；424769→422877；actor virtual+88参数1..4 | `apps/web/src/render/battle-players.ts` hurt；`assets/tanks/tank-view.ts` hurt/单次原时钟 | 同一合法hit的hurtSelector，死亡09覆盖hurt | 同player-result-13-54-00-875Z.json两端实际hurt动作7/6次及死亡/满血复活；原hurt具体四部件draw/尾帧`recovery/output/browser-combat-hit.json`（map7原105）；001不同方向专属证据保留各自地图范围，不转称同一map7整链 |
| 场景结果远端007/SE30/GA07 | ShotItem3aa4→4247aa远端尾部→423956/423092；本机跳过 | `apps/web/src/assets/tanks/shot-item-result.ts` show；`audio/battle-sound.ts` shotItemResult；不再次fire03/004 | map7模式1默认2001，普通Arrow面向ENV79、Space自然损坏；仅合法sceneObjectDestroyed携带结果 | `recovery/output/browser-combat-shot-item-result-2026-10-04T14-19-36-181Z.json`：本机feedback0及结果效果/声音0，远端007五原节点实绘并自然结束，二维SE30playing/ended、GA07非循环ended；result-canvas-2.png帧234与actual-1/2.png |
| ENV79源破坏 | 44e081原按模型分派；obj05462破损模型及GA41 | `apps/web/src/assets/scenes/scene-preview.ts` destroyObject/updateObjects，原broken模型/空间声音 | 同map7模式1合法ENV79五次自然伤害后destroy | 同scene-result-14-19-36-181Z.json：两端源破损模型287次提交/七原节点，GA41各1次playing/ended；既有原破坏source复用 |

表中`assets/...`、`render/...`相对`apps/web/src/`。主入口统一由`apps/web/src/match/battle.ts`接收fire/hit/scene事务；root维护该入口及World/协议。证据组合覆盖现有基础表现，不创建新的组合PASS或宣称每一个短命实例都绘制所有节点。

客户端消费者不决定伤害和目标资格；当前普通2001权威事务由主线记录。既有结果浏览器证据保留各自当时服务端时序范围，不能将早期验收当作更新后所有规则的重新证明。

## 父项边界

普通001及105死亡09、原事件/ELK资格、动作尾帧、复活01已有combat-death-t01与combat-death-09实际消费者及验收。001原死亡ELK缺组对应静默。死亡计数观察者来源是独立UI交付，不能充当射击特效阶段成果。

原服务器目标查询几何、伤害授权和结果消息生产完整合同仍未取得；当前查询及伤害政策明确为重建。原ShotItem远端再次Shot反馈已有直接接收来源，但原服务器是否避免同射击其他Shot通知重复尚不明确。独立客户端可见飞行创建/更新来源仍未确认；这些父项缺口不阻断已证明的即时目标显示和结果消费者。

当前合法普通2001链没有已证明但漏接的核心FX消费者，也没有已确认的独立低HP烟雾或残骸创建合同。本轮仅收拢已有证据，不新增技能、地图、外观或验收编号。
