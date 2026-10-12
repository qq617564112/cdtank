# M4-09 / M4-10 好炮弹受害者原008表现

普通2002好炮弹的受害者表现使用原skill4021/TriggerType8，第一槽Effect8、SE31、tag0、method3。原424614受害者分派与4886aa retention0终端复用既有`combat-shot-player-result-native.json`、`combat-shot-player-result-2011-native.json`；不重新执行已证的通用入口。

| 范围 | 当前证据 |
|---|---|
| 原来源 | 原item/skill表、完整008七节点、原DDS解码像素与SE31 WAV发布核对PASS_SOURCE_ONLY |
| 模块实现 | TankShotPlayerResult增加2002资格；真实树活tag0、自然结束/detach/stop释放PASS_MODULE_ONLY |
| 普通实战触发 | 双普通Account同一正式2002 hit、HP200→157已验 |
| 双端可辨/可听 | 原烟/爆炸/光sprite与SE31实际postgain、自然结束/Leave已验；两短strip双端实际提交缺口保留 |

主线已亲审guard、原来源合同、actual raw及双smoke整图，`combat-shot-player-result-2002-actual.json.mainReview`登记限定接受。M4-09/M4-10由主线原位记录，完整六节点双端精度及数量父范围保持开放。

## 原资源与消费者

`tests/combat-shot-player-result-2002-source.py`将原2002→4021三槽与正式catalog核对，逐原effect.sav完整节点记录核对发布库：2742根、2743烟粒子、2744/2745/2746三个sprite、2747/2757两个strip。每个子节点使用原有限delay/lifetime；逐具名纹理与原DDS decodedRGBA一致，SE31 WAV字节一致。对应output source.json/log不证明普通实战。

`apps/web/src/assets/tanks/shot-player-result.ts`只追加2002：正式shotPlayerResult.itemId2002→victim→原008/tag0/oneShottrue；声音独立SE31 selector1，本机/远端资格与当前裁剪行为沿原通用来源。2001/2011保留；2003/2006/2007等其他结果不泛接。World已有itemId事务，Battle已有受害者调用，不新增协议或事件。

`tests/combat-shot-player-result-2002.cts`验证明确开始参数、本机view传递和未恢复弹种静默；runtime.cts以真实EffectRuntime、原纹理与008树验证有限几何、活受害者挂点、正常逐帧自然释放、detach/stop释放。声音为录制边界，仅证明SE31 selector1，不当可听证明。

## 玩家验收与边界

专属`browser-combat-shot-player-result-2002.mjs`使用原合法map7/mode4普通双Account，host单射手/guest观察，正常Digit2/Arrow/Space；首命中后停火，不写活跃位置、HP、朝向、相机、时间或事件。原tank1/pet1及库存15/实例77/slot2为预房夹具，不证明正式BUY取得。临时独立Vite缓存与数据库均由runner释放。

`browser-combat-shot-player-result-2002-2026-10-04T18-57-56-395Z.json`保留FAIL：远端六节点均实际提交并保存整画布，本机仅烟/两爆炸sprite提交，严格六节点双端断言未通过，普通Leave未执行，不据进程清理当普通离房。原自然结束与双SE31输出有效，不重跑其来源。

`browser-combat-shot-player-result-2002-2026-10-04T19-01-07-070Z.json`为PASS_LIMITED_PLAYER_SCOPE：同一普通2002 hit，两端原烟2743、爆炸2744/2745与光2746提交，活受害者tag0，有限自然结束，原空间SE31单次playing/ended，实际postgain0.547899842/0.715787053。双方正常Leave后instances/meshes/voices/skillVoices全0，声音state stopped。natural-1-4-smoke.png和natural-2-6-smoke.png完整画布已亲看，受害者爆炸/烟/光清楚可辨。每端仅一个结果实例与SE31请求，原WAV和位置沿正式victim，不是替代声。

补段仅调整专属截图记录为first/smoke/full并将断言放到正常Leave后；源节点的时长、delay和生产renderer未改。其2747/2757两个.15秒strip没有实际提交，首raw只证明远端曾提交，原因尚未定位。不将树资源存在、module几何或远端片冒为全部节点双端实证；同短节点缺口已两次，保存而不第三同类run。

`tests/combat-shot-player-result-2002-actual.cts`生成actual.json/log，组合首raw远端六节点与补段有限双端画面/SE31/结束/Leave，missing按端明确列出。当前2002 shot后的quantity15未变化，原计数/消费producer交主线，未改计数政策，本片不证明有限库存业务。

原炮口54/GA09资源与通用原fire分派沿已证来源，不把本片受害者验收自动扩为全部2002射击链。当前server特殊弹药damage/flight、数量及生命规则属于既有明示重建，本片不决定或修改。完整六节点双端实际提交、全部弹种、2002消费/BUY、原server政策、HD、完整M4-09/M4-10父项保持未完成。
