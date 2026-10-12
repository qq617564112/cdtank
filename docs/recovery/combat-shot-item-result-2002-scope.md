# M4-09 / M4-10 2002远端场景结果

正式2002致死场景事务现已触发原远端world008/二维SE31与GA10反馈，本机结果保持静默。唯一普通四Account玩家片`browser-combat-shot-item-result-2002-2026-10-04T20-09-15-941Z.json`为PASS，组合actual.json/log为PASS_LIMITED_PLAYER_SCOPE。

| 层次 | 证据范围 |
|---|---|
| 原来源 | 既有4247aa远端尾部、2002第二技能4021→008/SE31、原Shot声音51/GA10 |
| 正式消费者 | TankShotItemResult与BattleSound只追加2002资格，原端点/f32/二维声→射手位置反馈顺序、本机静默CTS通过 |
| 普通触发 | 正常Shop BUY6→Home实例→普通Digit2/Arrow/Space，ENV79五次损伤后同值致死事务 |
| 实绘/声音/结束 | 观察端六draw/完整320×180爆火烟可辨、SE31实际wave与GA10实际wave及自然结束；本机无新增结果树/声；双Leave全0 |

## 原合同与业务接线

原424862比较攻击者与本机，仅远端继续；424883把结果端点传423956；424888压入message+10物件ID，424890调用423092。尾部没有2001限定。既有scene-breach21-hit-native.json的完整入口/执行与原指令直接复用。2002的008完整节点/原DDS/SE31 WAV/有限runtime复用combat-shot-player-result-2002-source/runtime，原Shot反馈按已有battleFire原分派取51/GA10，使用攻击者位置，不额外启动03或炮口。

主线projectile-scene-result.ts在World真实scene/objective damage之后，仅新sceneObjectDestroyed/objectiveDestroyed且playerId匹配附冻结2002与毁灭event端点。近射口障碍即时回调沿同限定事务，2001旧gate保留；非致死、terrain、fire、其他弹和医疗不附。projectile-scene-result.json/log为真实damage事务模块证据；projectile-scene-result-world.json/log另为普通World输入与模拟clock/库存夹具证据，均独立于本浏览器画布。伤害、破坏和弹丸业务沿主线明确重建，本片不更改。

## 首次普通双页证据

合法map7/mode1四正常认证Account，双React加两个正规Account/Join/Ready辅助玩家，无CPU、无活跃位置/HP/时间/相机/事件注入。预房原tank1/pet1拥有和资金100/0为明确夹具，初始弹药库存空；正式Shop购入好炮弹6，余额70/0，新instance1在Home配置槽1。普通host瞄准原ENV79并Space五发，hp200→0即松Space；最终双权威snapshot余量1。

双端同一sceneObjectDestroyed目标ENV79，shotItemResult冻结2002，端点[154.8376922607422,19.261383056640625,533.7213134765625]与毁灭event端点一致。射手本机feedback0/resultTrees0/二维声0/GA声0。观察端feedback1，root2742 world008一棵，2743/2744/2745/2746/2747/2757全部实际提交并自然expired；result-canvas-2.png完整320×180画布已亲看原明亮爆炸、火烟与原破损物件，主线也已亲看。

观察端二维SE31单次playing/ended，media captureStream波形峰1.0664986372，原audio.volume0.5/mutedfalse；只读媒体侧支采样未改变原播放路由。GA10/id51单次ended，post-attenuation峰0.5632731318，位置为攻击者当时位置。双端原ENV79破损模型实际draw及GA41 playing/ended复用已有源消费者范围，不重复完整物件取证。声音观察器context结束后关闭，正常Leave双端instances/原特效meshes/Battlevoices0且state stopped。专属3380/5410/9610、临时库/cache/profile清理保存process-cleanup.json。

## 未完成范围

本片只关闭2002该远端场景结果呈现，高清、全部弹种/目标、原服务端破坏/伤害/flight与M4父项开放。余量1为本次最终对局snapshot；本次未新增Leave后Home或真实重启余量验收，已有2002购入/耗尽/重启业务证据独立复用。原008资源、2001场景结果、死亡再战不重复验收。

主线接受索引为projectile-scene-result-business-accepted.json：已亲审远端实际画布并限定接受，服务构建及统一Web类型/Vite发行通过。objective结果仅模块事务覆盖，不将本ENV79实战扩大为objective玩家验收。
