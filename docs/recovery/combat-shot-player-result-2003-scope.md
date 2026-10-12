# M4-09 / M4-10 真好炮弹受害者原009

当前缺失消费者为普通合法2003命中受害者的原skill4022/Effect9/SE32。现正式弹药选择已接受class3，World命中携带shotPlayerResult.itemId，Battle调用TankShotPlayerResult；该消费者目前没有2003资格。本片只恢复受害者呈现，不更改伤害、飞行、射速、弹匣或库存政策。

| 范围 | 当前状态 |
|---|---|
| 原来源 | 原2003/4022 Trigger8、009六节点、原DDS decodedRGBA和SE32 WAV发布核对PASS_SOURCE_ONLY |
| 模块实现 | 2003受害者资格已接，专属参数/静默边界及真实原009有限树/live parent/自然结束/detach/stop PASS_MODULE_ONLY |
| 普通实战触发 | 首次合法双Account同一正式2003命中、HP200→157已验 |
| 双端可辨/可听 | 原爆炸/两火粒子/.5秒条带、SE32实际输出与自然结束/Leave已验；.15秒条带3050未实际提交 |

`tests/combat-shot-player-result-2003-source.py`及对应output JSON/log直接核对原item.dat、skill.dat和effect.sav完整六节点。原009为3047根、3048爆炸sprite、3049/3051两个火粒子、3050/3052两个strip；子寿命分别1.5/2/.15/2/.5秒，不延长短节点以截画面。所有具名发布纹理与原DDS解码RGBA相同，SE32 WAV与原文件字节一致。

skill4022第一槽Effect9/SE32/tag0/method3，TriggerType8与普通非保留分支沿已证原424614/4886aa和actor挂点来源；不重复通用入口native。未来最小guard追加2003后使用现showPlayerResult(victim,itemId,localView)，原tag0/oneShottrue与独立SE32 selector1，不泛接2005同效果或其他特殊弹行为。

主线共享构建窗口已解除，仅现shot-player-result.ts追加2003资格。`tests/combat-shot-player-result-2003.cts`及runtime.cts对应output JSON/log为PASS_MODULE_ONLY；参数验证原009/tag0/oneShottrue、SE32 selector1和未恢复弹种静默，真实原009树验证有限几何、实时victim挂点及结束释放。声音录制边界不算实际可听。无需新协议或Battle入口。

验收范围为合法map7/mode4双普通Account、host正常选槽/瞄准/Space，首命中后停火；按真实first/particle阶段捕捉完整画布，不按全部短节点提交作为截图前提，也不将缺失节点自动算通过。检查同事务、原live tag、SE32非零实际输出、有限自然结束及正常Leave。预房原tank1/pet1和2003库存夹具须明确，不代正式BUY；原fire源分派单独复用，不按Item.Sound猜原GA声音。

`browser-combat-shot-player-result-2003-2026-10-04T19-08-30-960Z.json`为PASS_LIMITED_PLAYER_SCOPE。两个正常Account、无CPU，host单射手/guest观察，Digit2/Arrow/Space自然命中同P2。两端原3048爆炸sprite、3049/3051火粒子和3052条带实际提交、live victim tag0，原SE32单次playing/ended与postgain0.624093890/0.815459311。一个hit仅一个结果树与声音；原有限树自然quiescent释放，正常Leave后instances/meshes/Battlevoices/skillvoices全0。

natural-1-6-fire.png与natural-2-6-fire.png双完整画布已亲看，受害者原爆炸/火焰与环状条带可辨。3050原.15秒条带未实际提交，不能以module或几何存在算作双端实际恢复；不对原时长加delay、不追加同入口run。`tests/combat-shot-player-result-2003-actual.cts`生成actual.json/log，记录每端rendered/missing、正式hit、声音与清理范围。

预房库存15/实例77/slot2为显式夹具；2003 shot后quantity15未变化，沿2002同泛弹药计数问题交主线，不由FX修改，不证明正式BUY或有限库存消费。原2003伤害/flight/计数、3050双端实际精度、高清、完整M4父项仍未完成。
