# Crush07 正式射击状态

合法 mode1/3、map7 使用原 Crush75–77/obj05420，原 enabled 位为0/1/1。正式普通2001射击沿现接受输入、弹匣与reload链，水平原OBB选择最近场景物件，并与静态障碍、玩家目标比较距离；服务器许可与低物件水平查询为重建政策。源OBB不扩尺寸，效果parent独立使用原position/rotation矩阵。

原近端3aa4 ShotItem handler4247aa 经44e081隐藏门禁后调用45efb3。首结果将sceneCrushes.hidden设true，立即释放动态OBB/NAV，发布sceneCrushed、sceneCrush.placementId及原shotItemResult display。没有HP、伤害累减或Breach两秒淡出。disabled/hidden、非PLAYING与其他弹种不进入此事务。

MatchSnapshot.sceneCrushes只同步enabled/hidden；源75始终禁用。客户端快照只协调可见性，正式结果启动预保留051。服务器tick先发送snapshot再发送event，客户端本轮事件消费标志独立于snapshot.hidden。下一round恢复原enabled并停止旧051，保留场景owner；Leave/场景clear释放owner。快照和晚加载不重播效果。

代码：scene-objects.ts源资格、battle/scene-crush.ts状态与选择、battle/shot-query.ts竞选、World正式事务、environment.ts碰撞；rooms state/create/snapshot与shared wire；Battle事件/快照协调。地图线负责ScenePreview/provider/reconcile，FX负责原051inactive-retain/start/stop/release。

证据：scene-crush07-caller-source.json、state-native/matrix-native与transform源证据直接引用；scene-crush07-authority.json/log为模块资格、隐藏拒绝、立即碰撞释放与回合恢复。server/web生产项目类型通过，protocol生成完成；scene-crush07-wire-order模块确认snapshot-before-event首次消费/重复拒绝/round停止恢复。正式server构建与Web构建通过，406运行模块不含证据或验证依赖。

限制：原服务器射击许可/精确目标查询尚未恢复；source近端caller是具名静态来源。模块检查不能替代普通网络、双端051实绘/静默结束、Leave与正式再战验收，M3-08保持未完成。

首普通17-53-07-008Z为INCOMPLETE：两端未发Space，76保持hiddenfalse，051未触发。双Leave六资源0。实际P1直瞄查询首CRUSH76，P2首ENV45遮挡；crush07-first-current-query.log是首raw位置在独立field的只读资格核验，不代表实际命中。第二定向采用P1普通射手，双端表现与再战仍待验收。

普通玩家表现已验：browser-crush07-2026-10-04T18-02-22-466Z.json为PASS，P1正常2001场景结果两端相同，76立即隐藏；051仅启动一次，node2971原yan1实际实绘并静默自然结束，后续普通开火不重复接受。自然TIME_LIMIT后四正常Rematch恢复round2原enabled/hidden且不重播；双Leave六资源0。主线亲看双natural画布并审实际draw/phase/transaction。普通W穿越没有本次动作证据，碰撞释放模块不能替代该项；父保持未完成。
