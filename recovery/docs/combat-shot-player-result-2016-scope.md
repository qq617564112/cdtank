# 2016红包拿来／4014原025表现

M4-09／M4-10-I2016新切片为普通购入2016后角色命中的原025红包树与SE50，含正式Shop取得、Home选弹、权威开火/CAS与普通命中结果分派。原item2016分类3、价格50金币／50软星、`BattleUseMax=30`、技能`[2016,4014,0]`；skill2016 `Trigger0/Target1/Range0`为普通持有技能；4014 `Trigger8/Target1/Range1`、FuncType2、HP0，首槽`effectId=25/sound=SE50/tag0/method3`。原表`4014`的HP0是结果技能字段，本文不据此推导原damage公式，普通现damage沿既有采用链。

## 原来源与有限模块实证

直接读原表与SAV的完整11节点、10个drawable；原文字hbnl0、红包、gongji1与dian的DDS解码RGBA与发布PNG逐字节一致，SE50原WAV与发布WAV逐字节一致、时长`0.5238095238095238s`，树无type4声音节点。含2807 type6寿命0：controller0在`0..0.5s`以1000／秒连续发射、capacity30、particlelife1秒，controller1从`0.5s`起emit0且end0。真实EffectRuntime模块十node均曾非空submit，六秒后有限文字／红包及粒子内容结束，唯一非零type节点2807仍active、controller1、particles0。原生命周期duration0不自动结束，不能把可见内容结束等同原树release，不能擅设2.25秒expiry或改变共享随机流。

`combat-shot-player-result-2016-runtime.json`为`PASS_MODULE_DRAW_EXPLICIT_CLEAR_ONLY_NATURAL_TREE_RELEASE_GAP`：证明原来源、有限模块绘制与显式clear合同，不证明普通玩家触发、像素或SE50实际输出；首natural-end-fail.log保原。以上为已存来源与有限模块实证的限定范围，不作为当前新实现的browser／联机PASS。

## 正式完整普通链

现Shop精确加入2016正价、Home武器槽2..4、普通class3选弹、权威fire/CAS持久消费、原muzzle `53/GA08` 已通用支持；命中后同一`hit`事件写`shotPlayerResult.itemId=2016`，受害者端`TankShotPlayerResult`按item skillIds查Trigger8的4014，取首槽`effectId=25/tag0`挂原025树一次（retention0）并播`SE50` selector1；remote scene endpoint与scene声音资格经`TankShotItemResult`与`BattleSound.shotItemResult`完整consumer接入，本机／远端沿用现分派裁剪。现本地／远端、本机结果静默、其它item资格与explosive2005抑制边界均保持。

## Web资源回收政策与源边界

新增限定Web资源回收只作用于`EffectRuntimeTree.quiescent`的精确root `025` node index `2807`（type6）：除原`phase===0`分支外，仅当该节点当前已是最后一个controller、该controller emitter最大发射数为0、真实particle pool已drained、且lifecycle不再产生未来emission时才视为Web quiescent；其余节点全部沿现既有finite结束predicate。025 root无future restart／发射，可由已有真实timing/controller判定。不设任意expiry、不新增timer/polling/debug API，不改原phase／duration／controller／random／retained。

该回收是Web端不可再绘制内容的资源回收政策，不声称原025 stop writer已恢复，也不等同原SourceTree自然release。actor/round/leave与late-async cleanup全部沿现`EffectRuntime`入口；不新增global自动释放机制、feature flag或共享SourceTree规则。普通2016双端实测、原025 stop caller与HD仍待完成，M4-09／M4-10及FUNC-02父项保持未勾。
